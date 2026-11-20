import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function makeClient(url: string, key: string, token?: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  })
}

async function markCompleted(admin: ReturnType<typeof makeClient>, userId: string) {
  const completedAt = new Date().toISOString()
  try {
    const update = await admin.from('account_deletion_requests')
      .update({ state: 'completed', completed_at: completedAt })
      .eq('user_id', userId).eq('state', 'pending').select('user_id').maybeSingle()
    if (update.error) return false
    if (update.data?.user_id === userId) return true

    const current = await admin.from('account_deletion_requests')
      .select('state').eq('user_id', userId).maybeSingle()
    return !current.error && current.data?.state === 'completed'
  } catch {
    return false
  }
}

async function reconcileAuthUser(admin: ReturnType<typeof makeClient>, userId: string) {
  try {
    const lookup = await admin.auth.admin.getUserById(userId)
    if (lookup.error?.status === 404) return 'absent' as const
    if (!lookup.error && lookup.data.user?.id === userId) return 'present' as const
    return 'unknown' as const
  } catch {
    return 'unknown' as const
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  const authorization = request.headers.get('authorization') ?? ''
  const tokenMatch = authorization.match(/^Bearer\s+([^\s]+)$/i)
  if (!tokenMatch) return reply(401, { error: 'unauthorized' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return reply(503, { error: 'deletion_unconfirmed', retryable: true })

  const token = tokenMatch[1]
  const authClient = makeClient(url, anonKey)
  let callerId: string
  try {
    const verified = await authClient.auth.getUser(token)
    if (verified.error) {
      return verified.error.status >= 400 && verified.error.status < 500
        ? reply(401, { error: 'unauthorized' })
        : reply(503, { error: 'deletion_unconfirmed', retryable: true })
    }
    if (!verified.data.user?.id) return reply(401, { error: 'unauthorized' })
    callerId = verified.data.user.id
  } catch {
    return reply(503, { error: 'deletion_unconfirmed', retryable: true })
  }

  let payload: Record<string, unknown> = {}
  try {
    const raw = await request.text()
    if (raw.trim()) {
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reply(400, { error: 'invalid_request' })
      }
      payload = parsed as Record<string, unknown>
    }
  } catch {
    return reply(400, { error: 'invalid_request' })
  }
  // This operation has no body parameters. Reject every supplied field so a
  // target identity cannot be mistaken for authority, including future aliases.
  if (Object.keys(payload).length > 0) return reply(400, { error: 'invalid_request' })

  const callerClient = makeClient(url, anonKey, token)
  const admin = makeClient(url, serviceKey)

  // Do not touch Auth Admin until a durable pending marker is confirmed. If a
  // response was lost after commit, the caller-scoped status RPC reconciles it.
  let pendingConfirmed = false
  try {
    const begin = await callerClient.rpc('begin_account_deletion')
    pendingConfirmed = !begin.error && begin.data === 'deletion_pending'
  } catch {
    pendingConfirmed = false
  }
  if (!pendingConfirmed) {
    try {
      const status = await callerClient.rpc('get_account_deletion_status')
      pendingConfirmed = !status.error && status.data === 'deletion_pending'
    } catch {
      pendingConfirmed = false
    }
  }
  if (!pendingConfirmed) return reply(503, { error: 'deletion_unconfirmed', retryable: true })

  try {
    const marker = await admin.from('account_deletion_requests')
      .select('state').eq('user_id', callerId).maybeSingle()
    if (marker.error || marker.data?.state !== 'pending') {
      return reply(503, { error: 'deletion_unconfirmed', retryable: true })
    }
  } catch {
    return reply(503, { error: 'deletion_unconfirmed', retryable: true })
  }

  let deleteAcknowledged = false
  try {
    const deletion = await admin.auth.admin.deleteUser(callerId)
    deleteAcknowledged = !deletion.error
  } catch {
    deleteAcknowledged = false
  }

  if (!deleteAcknowledged) {
    const authState = await reconcileAuthUser(admin, callerId)
    if (authState === 'present') return reply(202, { state: 'deletion_pending', retryable: true })
    if (authState !== 'absent') return reply(503, { error: 'deletion_unconfirmed', retryable: true })
  }

  if (!await markCompleted(admin, callerId)) {
    // Reconcile once more if Auth deletion succeeded but the first marker write
    // was interrupted. The marker remains pending unless completion persisted.
    const authState = await reconcileAuthUser(admin, callerId)
    if (authState === 'absent' && await markCompleted(admin, callerId)) {
      return reply(200, { state: 'completed' })
    }
    return reply(503, { error: 'deletion_unconfirmed', retryable: true })
  }

  return reply(200, { state: 'completed' })
})
