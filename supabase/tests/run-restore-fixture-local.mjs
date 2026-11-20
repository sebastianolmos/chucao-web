import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const configPath = fileURLToPath(new URL('../config.toml', import.meta.url))
const dockerExecutable = process.env.DOCKER_EXECUTABLE
  ?? join(process.env.LOCALAPPDATA ?? '', 'Programs/DockerDesktop/resources/bin/docker.exe')
const container = 'supabase_db_chucao-web'
const runId = randomUUID().replaceAll('-', '').slice(0, 12)
const databaseNames = ['snapshot', 'pending', 'completed', 'failure']
  .map((name) => `vs07_restore_${runId}_${name}`)
const manifestIds = [randomUUID(), randomUUID(), randomUUID()]
const activeId = randomUUID()
const listIds = [randomUUID(), randomUUID()]
const conceptIds = [randomUUID(), randomUUID()]
const roundIds = [randomUUID(), randomUUID()]
const appearanceIds = [randomUUID(), randomUUID()]
const practiceIds = [randomUUID(), randomUUID()]
let tempDirectory
const createdDatabases = new Set()

class VerificationError extends Error {}

function run(command, args, { input, timeout = 120_000, binary = false } = {}) {
  try {
    return execFileSync(command, args, {
      cwd: root, input, encoding: binary || input instanceof Buffer ? null : 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], timeout, maxBuffer: 120 * 1024 * 1024,
    })
  } catch (error) {
    const operation = command === dockerExecutable
      ? args.find((argument) => ['inspect', 'pg_dump', 'pg_restore', 'psql'].includes(argument))
      : args[0].split(/[\\/]/).at(-1)
    const safeError = operation === 'inspect'
      ? String(error.message ?? '').split(/\r?\n/)[0].slice(0, 260)
      : operation === 'pg_restore'
      ? String(error.stderr?.toString?.() || error.message || '').split(/\r?\n/).find((line) => /error|failed|cannot|does not exist/i.test(line))
      : operation === 'psql'
        ? String(error.stderr?.toString?.() || '').split(/\r?\n/).find((line) => /ERROR:|FATAL:/i.test(line))
      : operation === 'node.exe' || operation === 'supabase.js'
        ? String(error.stderr?.toString?.() || '').split(/\r?\n/).find((line) => /error|failed|permission/i.test(line))?.replace(/\{[\s\S]*$/, '[details suppressed]')
      : null
    const exit = Number.isInteger(error.status) ? ` (exit ${error.status})` : ''
    const spawnCode = error.code !== undefined ? ` (${String(error.code)})` : ''
    throw new VerificationError(`Local restore fixture ${operation} command failed${exit}${spawnCode}${safeError ? `: ${safeError}` : ' (details suppressed)'}`)
  }
}

function docker(args, options) {
  return run(dockerExecutable, ['exec', ...(options?.input ? ['-i'] : []), container, ...args], options)
}

function psql(database, sql, options = {}) {
  if (!/^vs07_restore_[a-f0-9]{12}_(snapshot|pending|completed|failure)$/.test(database)
    && database !== 'postgres') throw new VerificationError('Refusing an unrecognized local database name')
  return docker(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', database,
    '-At', '-F', '|', '-c', sql], options).trim()
}

function sqlLiteral(value) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new VerificationError('Invalid synthetic UUID')
  return `'${value}'`
}

function check(condition, message) {
  if (!condition) throw new VerificationError(message)
}

async function createDatabase(database) {
  check(/^vs07_restore_[a-f0-9]{12}_(snapshot|pending|completed|failure)$/.test(database), 'Invalid disposable database name')
  psql('postgres', `create database ${database}`)
  createdDatabases.add(database)
}

function restrictFixtureDirectory(directory) {
  if (process.platform !== 'win32') return
  const currentPrincipal = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
  const icacls = join(process.env.WINDIR ?? 'C:/Windows', 'System32/icacls.exe')
  try {
    execFileSync(icacls, [directory, '/inheritance:r', '/grant:r', `${currentPrincipal}:(OI)(CI)F`, 'SYSTEM:(OI)(CI)F'], {
      cwd: root, stdio: ['ignore', 'ignore', 'ignore'], timeout: 15_000,
    })
  } catch {
    throw new VerificationError('Could not restrict access to the temporary recovery fixture')
  }
}

async function restoreSchema(database, schemaArchive) {
  docker(['pg_restore', '--username', 'supabase_admin', '--exit-on-error', '--no-owner', '--dbname', database], { input: schemaArchive })
}

async function restoreSnapshot(database, schemaArchive, dataArchive) {
  await createDatabase(database)
  await restoreSchema(database, schemaArchive)
  docker(['pg_restore', '--username', 'supabase_admin', '--exit-on-error', '--no-owner', '--no-privileges', '--data-only', '--dbname', database], { input: dataArchive })
}

async function applyManifest(database, manifest) {
  // Fail-closed validation occurs before SQL is constructed. The persisted
  // manifest contains only UUID, state, and timestamp.
  check(Object.keys(manifest).sort().join(',') === 'requested_at,state,user_id', 'Manifest contains unexpected fields')
  check(/^[0-9a-f-]{36}$/i.test(manifest.user_id), 'Manifest UUID is invalid')
  check(['pending', 'completed'].includes(manifest.state), 'Manifest lifecycle state is invalid')
  check(!Number.isNaN(Date.parse(manifest.requested_at)), 'Manifest timestamp is invalid')
  psql(database, `insert into public.account_deletion_requests (user_id,state,requested_at,completed_at) values (${sqlLiteral(manifest.user_id)},'${manifest.state}','${manifest.requested_at}'::timestamptz,${manifest.state === 'completed' ? `'${manifest.requested_at}'::timestamptz` : 'null'}) on conflict (user_id) do update set state=excluded.state,requested_at=excluded.requested_at,completed_at=excluded.completed_at`)
}

function authContext(userId) {
  return `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${userId}',true); select set_config('request.jwt.claim.role','authenticated',true);`
}

async function verifyRestricted(database, ownerId, ownConceptId, manifestState, hasRestoredData = true, hasProfile = true) {
  const sql = `${authContext(ownerId)}
    select public.get_account_deletion_status();
    select count(*) from public.profiles where id='${ownerId}';
    select count(*) from public.lists where owner_id='${ownerId}';
    select count(*) from public.concepts where id='${ownConceptId}';
    select count(*) from public.rounds r join public.lists l on l.id=r.list_id where l.owner_id='${ownerId}';
    select count(*) from public.round_appearances a join public.rounds r on r.id=a.round_id join public.lists l on l.id=r.list_id where l.owner_id='${ownerId}';
    select count(*) from public.practices where owner_id='${ownerId}';
    select count(*) from public.practice_notes n join public.practices p on p.id=n.practice_id where p.owner_id='${ownerId}';
    rollback;`
  const values = psql(database, sql).split(/\r?\n/).filter(Boolean)
  check(values.includes('deletion_pending'), `${manifestState} account status was not pending after restore`)
  check(values.filter((value) => value === '0').length === 7, `${manifestState} owner could read restored private rows`)
  const activeContext = `${authContext(activeId)}
    select count(*) from public.profiles where id='${activeId}';
    select count(*) from public.lists where id='${listIds[1]}';
    select count(*) from public.concepts where id='${conceptIds[1]}';
    select count(*) from public.rounds where id='${roundIds[1]}';
    select count(*) from public.round_appearances where id='${appearanceIds[1]}';
    select count(*) from public.practices where id='${practiceIds[1]}';
    select count(*) from public.practice_notes where practice_id='${practiceIds[1]}';
    rollback;`
  const activeCounts = psql(database, activeContext).split(/\r?\n/).filter((value) => /^[01]$/.test(value))
  check(activeCounts.join(',') === '1,1,1,1,1,1,1', `Unrelated active synthetic owner lost access (row counts: ${activeCounts.join(',')})`)

  const write = `${authContext(ownerId)} select public.ensure_profile(); rollback;`
  let profileRecreated = false
  try { psql(database, write) } catch { profileRecreated = true }
  check(profileRecreated, `${manifestState} owner was able to recreate a profile`)
  const profileCount = psql(database, `select count(*) from public.profiles where id='${ownerId}'`)
  check(profileCount === (hasProfile ? '1' : '0'), 'Profile state changed after blocked recreation attempt')

  const mutation = `${authContext(ownerId)} select public.create_private_list('Restore must stay blocked'); rollback;`
  let mutationRejected = false
  try { psql(database, mutation) } catch { mutationRejected = true }
  check(mutationRejected, `${manifestState} owner could mutate restored private data`)
  check(psql(database, `select count(*) from public.lists where owner_id='${ownerId}'`) === (hasRestoredData ? '1' : '0'), 'Blocked mutation left partial data')
}

async function main() {
  try {
  const config = await readFile(configPath, 'utf8')
  check(/^project_id\s*=\s*"chucao-web"\s*$/m.test(config), 'Local Supabase project id does not match the fixture target')
  const inspect = JSON.parse(run(dockerExecutable, ['inspect', container, '--format', '{{json .Config.Labels}}']))
  check(inspect['com.supabase.cli.project'] === 'chucao-web', 'Database container does not match local project')
  check(run(dockerExecutable, ['inspect', container, '--format', '{{.State.Running}}']).trim() === 'true', 'Local database container is not running')

  tempDirectory = await mkdtemp(join(tmpdir(), 'chucao-vs07-restore-'))
  restrictFixtureDirectory(tempDirectory)
  const schemaArchive = docker(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--format=custom', '--schema-only'], { binary: true })
  const snapshot = databaseNames[0]
  await createDatabase(snapshot)
  await restoreSchema(snapshot, schemaArchive)

  const [pendingId, completedId, invalidId] = manifestIds
  const seedSql = `
    insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
      values ('${pendingId}','authenticated','authenticated','pending-${runId}@example.invalid','',now(),now(),now(),'{}','{}',false,false),
             ('${completedId}','authenticated','authenticated','completed-${runId}@example.invalid','',now(),now(),now(),'{}','{}',false,false),
             ('${activeId}','authenticated','authenticated','active-${runId}@example.invalid','',now(),now(),now(),'{}','{}',false,false);
    insert into public.profiles(id,locale) values ('${pendingId}','es'),('${completedId}','en'),('${activeId}','es');
    insert into public.lists(id,owner_id,name,name_normalized) values
      ('${listIds[0]}','${pendingId}','Pending synthetic','pending synthetic'),
      ('${listIds[1]}','${activeId}','Active synthetic','active synthetic');
    insert into public.concepts(id,list_id,title,description,state,position) values
      ('${conceptIds[0]}','${listIds[0]}','Pending concept','Synthetic content','seen',1),
      ('${conceptIds[1]}','${listIds[1]}','Active concept','Synthetic content','seen',1);
    insert into public.rounds(id,list_id,status,opened_at) values
      ('${roundIds[0]}','${listIds[0]}','open',now()),
      ('${roundIds[1]}','${listIds[1]}','open',now());
    insert into public.round_appearances(id,round_id,concept_id,appearance_order,origin,title_snapshot) values
      ('${appearanceIds[0]}','${roundIds[0]}','${conceptIds[0]}',1,'draw','Pending concept'),
      ('${appearanceIds[1]}','${roundIds[1]}','${conceptIds[1]}',1,'draw','Active concept');
    insert into public.practices(id,owner_id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,duration_minutes,completed_at,request_fingerprint) values
      ('${practiceIds[0]}','${pendingId}','associated','${listIds[0]}','${conceptIds[0]}','${roundIds[0]}','${appearanceIds[0]}','Pending concept',5,now(),'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      ('${practiceIds[1]}','${activeId}','associated','${listIds[1]}','${conceptIds[1]}','${roundIds[1]}','${appearanceIds[1]}','Active concept',5,now(),'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    insert into public.practice_notes(practice_id,body) values
      ('${practiceIds[0]}','Synthetic pending note'),
      ('${practiceIds[1]}','Synthetic active note');
  `
  psql(snapshot, seedSql)
  const snapshotArchive = docker(['pg_dump', '-U', 'postgres', '-d', snapshot, '--format=custom', '--data-only',
    '--table=auth.users', '--table=public.profiles', '--table=public.lists', '--table=public.concepts',
    '--table=public.rounds', '--table=public.round_appearances', '--table=public.practices', '--table=public.practice_notes'], { binary: true })
  const snapshotPath = join(tempDirectory, 'pre-deletion.dump')
  await writeFile(snapshotPath, snapshotArchive, { mode: 0o600 })
  const checkedSnapshot = await readFile(snapshotPath)
  check(checkedSnapshot.equals(snapshotArchive), 'Pre-deletion snapshot could not be verified')

  const pendingManifest = { user_id: pendingId, state: 'pending', requested_at: new Date().toISOString() }
  const completedManifest = { user_id: completedId, state: 'completed', requested_at: new Date().toISOString() }
  const pendingPath = join(tempDirectory, 'pending-manifest.json')
  const completedPath = join(tempDirectory, 'completed-manifest.json')
  await writeFile(pendingPath, `${JSON.stringify(pendingManifest)}\n`, { mode: 0o600 })
  await writeFile(completedPath, `${JSON.stringify(completedManifest)}\n`, { mode: 0o600 })

  const pendingDb = databaseNames[1]
  await restoreSnapshot(pendingDb, schemaArchive, checkedSnapshot)
  check(psql(pendingDb, 'select count(*) from public.account_deletion_requests') === '0', 'Deletion manifest was included in the pre-deletion snapshot')
  await applyManifest(pendingDb, JSON.parse(await readFile(pendingPath, 'utf8')))
  psql(pendingDb, `delete from public.profiles where id='${pendingId}'`)
  await verifyRestricted(pendingDb, pendingId, conceptIds[0], 'pending', true, false)

  const completedDb = databaseNames[2]
  await restoreSnapshot(completedDb, schemaArchive, checkedSnapshot)
  check(psql(completedDb, 'select count(*) from public.account_deletion_requests') === '0', 'Deletion manifest was included in the pre-deletion snapshot')
  await applyManifest(completedDb, JSON.parse(await readFile(completedPath, 'utf8')))
  // The marker is durable before simulating the terminal Auth deletion.
  psql(completedDb, `delete from public.rounds r using public.lists l where r.list_id=l.id and l.owner_id='${completedId}'; delete from auth.users where id='${completedId}'`)
  check(psql(completedDb, `select count(*) from auth.users where id='${completedId}'`) === '0', 'Completed account retained an Auth identity')
  check(psql(completedDb, `select count(*) from public.lists where owner_id='${completedId}'`) === '0', 'Deleted account data was reactivated')
  check(psql(completedDb, `select state from public.account_deletion_requests where user_id='${completedId}'`) === 'completed', 'Completed manifest marker was not retained')
  await verifyRestricted(completedDb, completedId, conceptIds[0], 'completed', false, false)

  const failureDb = databaseNames[3]
  await restoreSnapshot(failureDb, schemaArchive, checkedSnapshot)
  check(psql(failureDb, 'select count(*) from public.account_deletion_requests') === '0', 'Deletion manifest was included in the pre-deletion snapshot')
  const invalidManifest = { user_id: invalidId, state: 'active', requested_at: new Date().toISOString() }
  const invalidPath = join(tempDirectory, 'invalid-manifest.json')
  await writeFile(invalidPath, `${JSON.stringify(invalidManifest)}\n`, { mode: 0o600 })
  let replayRejected = false
  try { await applyManifest(failureDb, JSON.parse(await readFile(invalidPath, 'utf8'))) } catch { replayRejected = true }
  check(replayRejected, 'Invalid manifest unexpectedly replayed')
  psql('postgres', `alter database ${failureDb} with allow_connections false`)
  let unavailable = false
  try { psql(failureDb, 'select 1') } catch { unavailable = true }
  check(unavailable, 'Candidate remained available after manifest replay failed')
  psql('postgres', `alter database ${failureDb} with allow_connections true`)
  check(psql(failureDb, `select count(*) from public.lists where owner_id='${pendingId}'`) === '1', 'Failure fixture baseline was not preserved for cleanup verification')

  console.log('PASS isolated local restore: pending and completed owners blocked; active synthetic owner retained access; failed replay kept candidate unavailable')
} finally {
  for (const database of createdDatabases) {
    try {
      psql('postgres', `alter database ${database} with allow_connections true`)
      psql('postgres', `drop database ${database} with (force)`)
    } catch {
      process.exitCode = 1
      console.error('FAIL disposable database cleanup (details suppressed)')
    }
  }
  if (tempDirectory) {
    try { await rm(tempDirectory, { recursive: true, force: true }) }
    catch { process.exitCode = 1; console.error('FAIL temporary fixture cleanup (details suppressed)') }
  }
  if (process.exitCode !== 1) console.log('PASS temporary database, snapshot, and manifest cleanup')
}
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof VerificationError ? error.message : 'Local restore verification failed (details suppressed)'}`)
  process.exitCode = 1
})
