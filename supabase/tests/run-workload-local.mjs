import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const apiUrl = process.env.T11_SUPABASE_URL
const anonKey = process.env.T11_SUPABASE_ANON_KEY
const serviceKey = process.env.T11_SUPABASE_SERVICE_KEY
const previewUrl = 'http://127.0.0.1:4175/'
const signInRedirectUrl = new URL('/t11-auth.html', previewUrl).href
const bridgePath = fileURLToPath(new URL('../../dist/t11-auth.html', import.meta.url))
const bridgeHtml = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Local test session</title></head>
<body><p>Preparing the synthetic local session…</p><script>
(() => {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (!accessToken || !refreshToken) {
    document.body.textContent = 'The local test sign-in did not return a session.';
    return;
  }
  const encoded = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
  const timestamp = new Date(claims.iat * 1000).toISOString();
  localStorage.setItem('sb-127-auth-token', JSON.stringify({
    access_token: accessToken, refresh_token: refreshToken,
    token_type: fragment.get('token_type') || 'bearer',
    expires_in: Number(fragment.get('expires_in')),
    expires_at: Number(fragment.get('expires_at')),
    user: {
      id: claims.sub, aud: claims.aud, role: claims.role, email: claims.email,
      app_metadata: claims.app_metadata, user_metadata: claims.user_metadata,
      identities: [], created_at: timestamp, updated_at: timestamp,
      email_confirmed_at: timestamp, confirmed_at: timestamp, phone: '', is_anonymous: false,
    },
  }));
  window.history.replaceState(null, '', '/t11-auth.html');
  window.location.replace('/');
})();
</script></body></html>`

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

function client(key) {
  return createClient(apiUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, redirect: 'error', signal: AbortSignal.timeout(15_000),
    }) },
  })
}

function validateLocalConfiguration() {
  if (!apiUrl || !anonKey || !serviceKey) throw new Error('Local Supabase environment variables are required')
  const url = new URL(apiUrl)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Refusing to create workload data outside local loopback Supabase')
  }
}

function installSessionBridge() {
  if (existsSync(bridgePath)) throw new Error('Refusing to overwrite an existing local workload bridge')
  writeFileSync(bridgePath, bridgeHtml, { flag: 'wx' })
}

function removeSessionBridge() {
  if (!existsSync(bridgePath)) return
  if (readFileSync(bridgePath, 'utf8') !== bridgeHtml) {
    throw new Error('The local workload bridge changed; leaving it in place for review')
  }
  unlinkSync(bridgePath)
}

async function setup() {
  validateLocalConfiguration()
  const admin = client(serviceKey)
  const runId = randomUUID()
  const localUrl = new URL(apiUrl)
  const email = `t11-${runId}@example.invalid`
  installSessionBridge()
  const created = await admin.auth.admin.createUser({
    email, email_confirm: true, app_metadata: { fixture: 'T11-local-workload', run_id: runId },
  })
  if (created.error || !created.data.user) {
    removeSessionBridge()
    throw new Error('Synthetic account creation failed (details suppressed)')
  }
  const ownerId = created.data.user.id

  try {
    const profile = await admin.from('profiles').upsert({
      id: ownerId, locale: 'es', default_timer_minutes: 5,
      completion_sound_enabled: false, sound_volume: 25, reduced_motion: true,
    })
    if (profile.error) throw new Error('Synthetic profile setup failed (details suppressed)')

    const lists = Array.from({ length: 10 }, (_, index) => {
      const id = randomUUID()
      return {
        id, owner_id: ownerId, name: `Carga personal ${String(index + 1).padStart(2, '0')}`,
        name_normalized: `carga personal ${String(index + 1).padStart(2, '0')}`,
      }
    })
    const listInsert = await admin.from('lists').insert(lists)
    if (listInsert.error) throw new Error('Synthetic list setup failed (details suppressed)')

    const concepts = lists.flatMap((list, listIndex) => Array.from({ length: 50 }, (_, conceptIndex) => ({
      id: randomUUID(), list_id: list.id, title: `Concepto ${String(conceptIndex + 1).padStart(2, '0')}`,
      description: `Descripción sintética ${String(conceptIndex + 1).padStart(2, '0')} de la lista ${listIndex + 1}.`,
      state: conceptIndex % 2 === 0 ? 'seen' : 'pending', position: conceptIndex + 1,
    })))
    for (let offset = 0; offset < concepts.length; offset += 200) {
      const result = await admin.from('concepts').insert(concepts.slice(offset, offset + 200))
      if (result.error) throw new Error('Synthetic concept setup failed (details suppressed)')
    }

    const practices = Array.from({ length: 200 }, (_, index) => {
      const conceptIndex = index % concepts.length
      const concept = concepts[conceptIndex]
      const list = lists[Math.floor(conceptIndex / 50)]
      return {
        id: randomUUID(), owner_id: ownerId, kind: 'associated', list_id: list.id,
        concept_id: concept.id, title_snapshot: concept.title, duration_minutes: 5,
        completed_at: new Date(Date.now() - index * 60_000).toISOString(),
        rating: index % 3 === 0 ? null : index % 6,
        request_fingerprint: index.toString(16).padStart(64, '0'),
      }
    })
    const historyInsert = await admin.from('practices').insert(practices)
    if (historyInsert.error) throw new Error('Synthetic history setup failed (details suppressed)')

    const counts = await Promise.all([
      admin.from('lists').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
      admin.from('concepts').select('id', { count: 'exact', head: true }).in('list_id', lists.map((list) => list.id)),
      admin.from('practices').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    ])
    if (counts.some((result) => result.error)
      || counts[0].count !== 10 || counts[1].count !== 500 || counts[2].count !== 200) {
      throw new Error('Synthetic fixture count verification failed')
    }

    const link = await admin.auth.admin.generateLink({
      type: 'magiclink', email, options: { redirectTo: signInRedirectUrl },
    })
    if (link.error || !link.data.properties?.action_link) throw new Error('Synthetic local sign-in link generation failed')
    const actionLink = new URL(link.data.properties.action_link)
    if (actionLink.hostname !== localUrl.hostname || actionLink.port !== localUrl.port) {
      throw new Error('Refusing a synthetic sign-in link outside local Supabase')
    }
    console.log(JSON.stringify({ ownerId, runId, lists: 10, concepts: 500, practiceHistory: 200, actionLink: link.data.properties.action_link }))
  } catch (error) {
    await admin.auth.admin.deleteUser(ownerId)
    removeSessionBridge()
    throw error
  }
}

async function cleanup(ownerId) {
  validateLocalConfiguration()
  if (!/^[0-9a-f-]{36}$/i.test(ownerId ?? '')) throw new Error('Cleanup requires the exact synthetic owner UUID')
  const admin = client(serviceKey)
  const [listRows, practiceRows] = await Promise.all([
    admin.from('lists').select('id', { count: 'exact' }).eq('owner_id', ownerId),
    admin.from('practices').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
  ])
  if (listRows.error || practiceRows.error) throw new Error('Synthetic fixture cleanup count failed')
  const conceptCount = listRows.data.length === 0 ? 0 : await admin.from('concepts')
    .select('id', { count: 'exact', head: true }).in('list_id', listRows.data.map((row) => row.id))
  if (conceptCount && conceptCount.error) throw new Error('Synthetic fixture cleanup count failed')
  const deleted = await admin.auth.admin.deleteUser(ownerId)
  if (deleted.error) {
    const existing = await admin.auth.admin.getUserById(ownerId)
    if (existing.data.user || existing.error?.status !== 404) throw new Error('Synthetic account cleanup failed')
  }
  removeSessionBridge()
  console.log(JSON.stringify({ ownerId, removed: { lists: listRows.count, concepts: conceptCount?.count ?? 0, practiceHistory: practiceRows.count }, accountRemoved: true }))
}

async function loginLink(ownerId) {
  validateLocalConfiguration()
  if (!/^[0-9a-f-]{36}$/i.test(ownerId ?? '')) throw new Error('Sign-in link requires the exact synthetic owner UUID')
  const admin = client(serviceKey)
  const existing = await admin.auth.admin.getUserById(ownerId)
  if (existing.error || !existing.data.user) throw new Error('Synthetic account was not found')
  if (!existsSync(bridgePath) || readFileSync(bridgePath, 'utf8') !== bridgeHtml) {
    throw new Error('The temporary local session bridge is missing or changed')
  }
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink', email: existing.data.user.email, options: { redirectTo: signInRedirectUrl },
  })
  if (link.error || !link.data.properties?.action_link) throw new Error('Synthetic local sign-in link generation failed')
  const actionLink = new URL(link.data.properties.action_link)
  const localUrl = new URL(apiUrl)
  if (actionLink.hostname !== localUrl.hostname || actionLink.port !== localUrl.port) {
    throw new Error('Refusing a synthetic sign-in link outside local Supabase')
  }
  console.log(link.data.properties.action_link)
}

try {
  const [command, ownerId] = process.argv.slice(2)
  if (command === 'setup') await setup()
  else if (command === 'login') await loginLink(ownerId)
  else if (command === 'cleanup') await cleanup(ownerId)
  else throw new Error('Usage: run-workload-local.mjs setup | login <synthetic-owner-uuid> | cleanup <synthetic-owner-uuid>')
} catch (error) {
  fail(error instanceof Error ? error.message : 'Synthetic workload fixture operation failed')
}
