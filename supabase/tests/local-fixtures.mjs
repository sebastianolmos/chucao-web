import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = fileURLToPath(new URL('../../', import.meta.url))

export class VerificationError extends Error {}

// Do not print SDK errors: they can include credentials or authored data.
export function requireResult(result, operation) {
  if (result.error) throw new VerificationError(`${operation} failed (details suppressed)`)
  return result.data
}

export function requireCondition(condition, message) {
  if (!condition) throw new VerificationError(message)
}

function deleteSyntheticList(listId) {
  requireCondition(/^[0-9a-f-]{36}$/i.test(listId), 'Invalid synthetic list identifier')
  const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url))
  try {
    execFileSync(process.execPath, [cli, 'db', 'query', '--output-format', 'json',
      `delete from public.lists where id = '${listId}'::uuid`], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    })
  } catch (error) {
    const code = /\b(?:235\d\d|23\d{3}|42\d{3})\b/.exec(`${error.stderr || ''}\n${error.stdout || ''}`)?.[0]
    throw new VerificationError(`Synthetic list deletion through local database CLI failed${code ? ` (${code})` : ' (details suppressed)'}`)
  }
}

export function inspectPracticeHistoryPagePlan(ownerId) {
  requireCondition(/^[0-9a-f-]{36}$/i.test(ownerId), 'Invalid synthetic history owner identifier')
  const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url))
  const sql = `explain (analyze, buffers, format json) select p.id, p.completed_at from public.practices p where p.owner_id = '${ownerId}'::uuid order by p.completed_at desc, p.id desc limit 101`
  try {
    const output = execFileSync(process.execPath, [cli, 'db', 'query', '--output-format', 'json', sql], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    })
    const parsed = JSON.parse(output)
    const planRows = parsed.rows?.[0]?.['QUERY PLAN']
    const nodeTypes = []
    const visit = (node) => {
      if (!node || typeof node !== 'object') return
      if (typeof node['Node Type'] === 'string') nodeTypes.push(node['Node Type'])
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit)
        else if (child && typeof child === 'object') visit(child)
      }
    }
    visit(planRows)
    return {
      bounded: nodeTypes.includes('Limit'),
      usesHistoryIndex: JSON.stringify(planRows).includes('practices_owner_completed_idx'),
    }
  } catch {
    throw new VerificationError('History workload query plan could not be inspected')
  }
}

function localConfiguration() {
  let status
  try {
    const output = execFileSync(process.execPath, [
      fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url)),
      'status', '-o', 'json',
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 })
    status = JSON.parse(output)
  } catch {
    throw new VerificationError('Local Supabase status unavailable; start the local project and check CLI permissions')
  }
  const url = new URL(status.API_URL)
  requireCondition(
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && url.protocol === 'http:' && !url.username && !url.password,
    'Refusing a non-loopback local Supabase API',
  )
  requireCondition(Boolean(status.ANON_KEY && status.SERVICE_ROLE_KEY && status.JWT_SECRET), 'Local CLI keys unavailable')
  return { url: url.origin, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY, jwtSecret: status.JWT_SECRET }
}

function client(url, key, token) {
  return createClient(url, key, {
    ...(token ? { accessToken: async () => token } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // Never follow a redirect carrying a privileged header away from loopback.
      fetch: (input, init) => fetch(input, {
        ...init, redirect: 'error', signal: AbortSignal.timeout(15_000),
      }),
    },
  })
}

// Google remains the application's only login provider. These short-lived local
// tokens exercise PostgREST signature/role/RLS enforcement, not OAuth login.
function fixtureToken(userId, secret) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userId, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 600,
  })}`
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}

// The admin client stays inside this setup/cleanup closure. Assertions receive
// only ordinary authenticated clients, an anonymous client and synthetic IDs.
export async function withLocalFixtures(run) {
  const config = localConfiguration()
  const admin = client(config.url, config.serviceKey)
  const runId = randomUUID()
  const users = []
  const roundIds = []
  const listIds = []
  const conceptIds = []
  const appearanceIds = []
  const practiceIds = []
  let primaryError
  let cleanupFailed = false
  const cleanupFailures = []

  try {
    const sessions = []
    for (const suffix of ['a', 'b']) {
      const email = `db-check-${runId}-${suffix}@example.invalid`
      const created = requireResult(await admin.auth.admin.createUser({
        email, email_confirm: true, app_metadata: { fixture_run: runId },
      }), 'Synthetic account creation')
      users.push(created.user.id)
      const session = client(config.url, config.anonKey, fixtureToken(created.user.id, config.jwtSecret))
      sessions.push(session)
    }

    requireResult(await admin.from('profiles').upsert(users.map((id) => ({
      id, locale: 'es', default_timer_minutes: 5,
      completion_sound_enabled: false, sound_volume: 25, reduced_motion: true,
    }))), 'Preference fixtures')

    for (const [index, ownerId] of users.entries()) {
      const id = randomUUID()
      listIds.push(id)
      requireResult(await admin.from('lists').insert({
        id, owner_id: ownerId, name: `Fixture ${index}`, name_normalized: `fixture ${index}`,
      }), 'List fixture')
    }
    const workloadListIds = [listIds[0]]
    for (let index = 1; index < 10; index += 1) {
      const id = randomUUID()
      listIds.push(id)
      workloadListIds.push(id)
      requireResult(await admin.from('lists').insert({
        id, owner_id: users[0], name: `History workload ${index}`, name_normalized: `history workload ${index}`,
      }), 'History workload list fixture')
    }
    const activeConceptId = randomUUID()
    const deletedConceptId = randomUUID()
    conceptIds.push(activeConceptId, deletedConceptId)
    requireResult(await admin.from('concepts').insert([
      { id: activeConceptId, list_id: listIds[0], title: 'Synthetic concept', description: '', state: 'seen', position: 1, deleted_at: null },
      { id: deletedConceptId, list_id: listIds[0], title: null, description: null, state: 'pending', position: 2, deleted_at: '2026-01-02T12:00:00Z' },
    ]), 'Concept fixtures')
    const workloadConceptIds = [activeConceptId]
    for (let index = 1; index < workloadListIds.length; index += 1) {
      const id = randomUUID()
      conceptIds.push(id)
      workloadConceptIds.push(id)
      requireResult(await admin.from('concepts').insert({
        id, list_id: workloadListIds[index], title: `Workload concept ${index}`, description: '',
        state: 'seen', position: 1,
      }), 'History workload concept fixture')
    }
    const roundId = randomUUID()
    roundIds.push(roundId)
    requireResult(await admin.from('rounds').insert({
      id: roundId, list_id: listIds[0], status: 'open', opened_at: '2026-01-01T12:00:00Z',
    }), 'Round fixture')
    const tiedRoundId = randomUUID()
    roundIds.push(tiedRoundId)
    requireResult(await admin.from('rounds').insert({
      id: tiedRoundId, list_id: listIds[0], status: 'closed',
      opened_at: '2026-01-01T12:00:00Z', closed_at: '2026-01-01T13:00:00Z',
    }), 'Equal-timestamp round fixture')
    const activeAppearanceId = randomUUID()
    const legacyAppearanceId = randomUUID()
    appearanceIds.push(activeAppearanceId, legacyAppearanceId)
    requireResult(await admin.from('round_appearances').insert([
      { id: activeAppearanceId, round_id: roundId, concept_id: activeConceptId, appearance_order: 1, origin: 'draw', title_snapshot: 'Synthetic concept', concept_deleted: false },
      { id: legacyAppearanceId, round_id: roundId, concept_id: deletedConceptId, appearance_order: 2, origin: 'manual', title_snapshot: null, concept_deleted: true },
    ]), 'Appearance fixtures')
    const practiceId = randomUUID()
    practiceIds.push(practiceId)
    requireResult(await admin.from('practices').insert({
      id: practiceId, owner_id: users[0], kind: 'associated', list_id: listIds[0],
      concept_id: activeConceptId, round_id: roundId, appearance_id: activeAppearanceId,
      title_snapshot: 'Synthetic concept', duration_minutes: 5,
      completed_at: '2026-01-03T12:00:00Z', rating: 0, request_fingerprint: 'a'.repeat(64),
    }), 'Practice fixture')
    requireResult(await admin.from('practice_notes').insert({
      practice_id: practiceId, body: 'Synthetic note', revision: 1,
    }), 'Practice note fixture')
    requireResult(await admin.from('practice_note_operations').insert({
      owner_id: users[0], practice_id: practiceId, operation_id: randomUUID(),
      operation_kind: 'delete', expected_revision: 1, resulting_revision: 1, outcome: 'deleted',
    }), 'Practice note operation fixture')
    const otherPracticeId = randomUUID()
    practiceIds.push(otherPracticeId)
    requireResult(await admin.from('practices').insert({
      id: otherPracticeId, owner_id: users[1], kind: 'independent', list_id: null,
      independent_label: 'Synthetic independent', duration_minutes: 5,
      completed_at: '2026-01-03T13:00:00Z', request_fingerprint: 'b'.repeat(64),
    }), 'Second owner practice fixture')
    requireResult(await admin.from('practice_notes').insert({
      practice_id: otherPracticeId, body: 'Second synthetic note', revision: 1,
    }), 'Second owner note fixture')
    requireResult(await admin.from('practice_note_operations').insert({
      owner_id: users[1], practice_id: otherPracticeId, operation_id: randomUUID(),
      operation_kind: 'update', expected_revision: 1, resulting_revision: 2, outcome: 'updated',
    }), 'Second owner receipt fixture')

    const workloadRows = Array.from({ length: 1000 }, (_, index) => {
      const independent = index % 10 === 0
      const id = randomUUID()
      practiceIds.push(id)
      const completedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(index / 17))).toISOString()
      return independent ? {
        id, owner_id: users[0], kind: 'independent', list_id: null,
        independent_label: index === 0 ? 'Literal [x] OR true --' : `Workload independent ${index}`,
        duration_minutes: 5, completed_at: completedAt,
        rating: index % 3 === 0 ? null : index % 6,
        request_fingerprint: index.toString(16).padStart(64, '0'),
      } : {
        id, owner_id: users[0], kind: 'associated', list_id: workloadListIds[index % workloadListIds.length],
        concept_id: workloadConceptIds[index % workloadConceptIds.length],
        title_snapshot: `Workload concept ${index % workloadConceptIds.length}`,
        duration_minutes: 5, completed_at: completedAt,
        rating: index % 3 === 0 ? null : index % 6,
        request_fingerprint: index.toString(16).padStart(64, '0'),
      }
    })
    for (let offset = 0; offset < workloadRows.length; offset += 200) {
      requireResult(await admin.from('practices').insert(workloadRows.slice(offset, offset + 200)), 'History workload practice fixtures')
    }
    const otherRoundId = randomUUID()
    roundIds.push(otherRoundId)
    requireResult(await admin.from('rounds').insert({
      id: otherRoundId, list_id: listIds[1], status: 'open', opened_at: '2026-01-04T12:00:00Z',
    }), 'Second owner round fixture')
    const otherAppearanceId = randomUUID()
    appearanceIds.push(otherAppearanceId)
    requireResult(await admin.from('round_appearances').insert({
      id: otherAppearanceId, round_id: otherRoundId, concept_id: null,
      appearance_order: 1, origin: 'manual', title_snapshot: 'Deleted account concept', concept_deleted: true,
    }), 'Second owner appearance fixture')

    await run({
      admin, deleteList: deleteSyntheticList,
      owner: sessions[0], other: sessions[1], anonymous: client(config.url, config.anonKey),
      ids: { owner: users[0], other: users[1], list: listIds[0], otherList: listIds[1],
        round: roundId, otherRound: otherRoundId, activeConcept: activeConceptId, deletedConcept: deletedConceptId,
        tiedRound: tiedRoundId,
        practice: practiceId, otherPractice: otherPracticeId,
        workloadLists: workloadListIds, workloadConcepts: workloadConceptIds,
        activeAppearance: activeAppearanceId, legacyAppearance: legacyAppearanceId },
    })
  } catch (error) {
    primaryError = error
  } finally {
    // Delete tracked rounds before accounts/lists so cleanup does not leave
    // detached anonymous totals. Never search/delete by an email or name prefix.
    for (const id of roundIds) {
      try { requireResult(await admin.from('rounds').delete().eq('id', id), 'Round cleanup') }
      catch { cleanupFailed = true; cleanupFailures.push('tracked round cleanup failed') }
    }
    for (const id of users) {
      try {
        const result = await admin.auth.admin.deleteUser(id)
        if (result.error) {
          const existing = await admin.auth.admin.getUserById(id)
          if (existing.data?.user || existing.error?.status !== 404) { cleanupFailed = true; cleanupFailures.push('tracked account deletion failed') }
        }
      } catch { cleanupFailed = true; cleanupFailures.push('tracked account deletion failed') }
    }
    for (const [table, column, ids] of [
      ['profiles', 'id', users], ['lists', 'id', listIds], ['concepts', 'id', conceptIds],
      ['practices', 'id', practiceIds], ['practice_notes', 'practice_id', practiceIds],
      ['practice_note_operations', 'practice_id', practiceIds], ['rounds', 'id', roundIds],
      ['round_appearances', 'id', appearanceIds],
    ]) {
      if (!ids.length) continue
      for (let offset = 0; offset < ids.length; offset += 200) {
        try {
          const remaining = requireResult(await admin.from(table).select(column).in(column, ids.slice(offset, offset + 200)), 'Cleanup readback')
          if (remaining.length !== 0) { cleanupFailed = true; cleanupFailures.push(`tracked ${table} rows remain`) }
        } catch { cleanupFailed = true; cleanupFailures.push(`tracked ${table} cleanup read failed`) }
      }
    }
    for (const id of users) {
      try {
        const result = await admin.auth.admin.getUserById(id)
        if (result.data?.user || result.error?.status !== 404) { cleanupFailed = true; cleanupFailures.push('tracked account remains') }
      } catch { cleanupFailed = true; cleanupFailures.push('tracked account readback failed') }
    }
  }
  if (cleanupFailed) throw new VerificationError(`Synthetic fixture cleanup/readback failed (${[...new Set(cleanupFailures)].join(', ')}); inspect local test data before retrying${primaryError instanceof VerificationError ? `; primary check: ${primaryError.message}` : ''}`)
  if (users.length) console.log('PASS cleanup: tracked accounts and rows absent')
  if (primaryError) throw primaryError
}
