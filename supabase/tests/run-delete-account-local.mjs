import { withLocalFixtures, requireCondition, requireResult, VerificationError } from './local-fixtures.mjs'

async function invokeFunction({ localUrl, anonKey, token, body }) {
  const headers = { apikey: anonKey }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${localUrl}/functions/v1/delete-account`, {
    method: 'POST', headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error', signal: AbortSignal.timeout(20_000),
  })
  let payload
  try { payload = await response.json() } catch { payload = null }
  return { status: response.status, payload }
}

try {
  await withLocalFixtures(async ({ admin, owner, other, ids, localUrl, anonKey, tokens, secretsAbsentFrom }) => {
    const missing = await invokeFunction({ localUrl, anonKey })
    requireCondition(missing.status === 401 && missing.payload?.error === 'unauthorized',
      'Missing JWT was not rejected by the deletion function')

    const invalid = await invokeFunction({ localUrl, anonKey, token: 'not-a-valid-jwt' })
    requireCondition(invalid.status === 401 && invalid.payload?.error === 'unauthorized',
      'Invalid JWT was not rejected by the deletion function')

    const spoofed = await invokeFunction({
      localUrl, anonKey, token: tokens.owner, body: { user_id: ids.other },
    })
    requireCondition(spoofed.status === 400 && spoofed.payload?.error === 'invalid_request',
      'Caller-supplied target account was not rejected')
    const earlyResponses = [missing, invalid, spoofed]
    requireCondition(earlyResponses.every((response) => Object.keys(response.payload ?? {}).sort().join(',') === 'error'
      && !JSON.stringify(response.payload).includes(ids.owner)
      && !JSON.stringify(response.payload).includes(ids.other))
      && secretsAbsentFrom(earlyResponses.map((response) => JSON.stringify(response.payload))),
    'Unauthorized/error response exposed an account identity or server credential')
    requireCondition(requireResult(await owner.rpc('get_account_deletion_status'), 'Owner status after rejected requests') === 'active'
      && requireResult(await other.rpc('get_account_deletion_status'), 'Other owner status after rejected requests') === 'active'
      && Boolean((await admin.auth.admin.getUserById(ids.owner)).data?.user)
      && Boolean((await admin.auth.admin.getUserById(ids.other)).data?.user),
    'Rejected requests changed either synthetic Auth account or lifecycle')

    const ownerListsBefore = requireResult(await admin.from('lists').select('id').eq('owner_id', ids.owner), 'Owner list baseline')
    const ownerListIds = ownerListsBefore.map((list) => list.id)
    const ownerPracticeBefore = requireResult(await admin.from('practices').select('id').eq('owner_id', ids.owner), 'Owner practice baseline')
    const ownerPracticeIds = ownerPracticeBefore.map((practice) => practice.id)
    const anonymousRoundsBefore = requireResult(await admin.from('rounds')
      .select('id,list_id,anonymous_appearance_total').is('list_id', null).order('id'), 'Anonymous round baseline')

    // Model a retry after the caller had already durably entered pending state.
    requireCondition(requireResult(await owner.rpc('begin_account_deletion'), 'Pending deletion retry setup') === 'deletion_pending',
      'Synthetic owner did not enter pending state')
    requireCondition(requireResult(await owner.rpc('begin_account_deletion'), 'Repeated pending deletion retry') === 'deletion_pending',
      'Pending lifecycle retry was not idempotent')

    const completed = await invokeFunction({ localUrl, anonKey, token: tokens.owner, body: {} })
    requireCondition(completed.status === 200 && completed.payload?.state === 'completed'
      && Object.keys(completed.payload).sort().join(',') === 'state',
    'Authenticated pending deletion did not return the minimal completed result')
    const responseText = JSON.stringify(completed.payload)
    requireCondition(!responseText.includes(ids.owner) && !responseText.includes(ids.other)
      && !/service[_ -]?role|eyJhbGciOi/.test(responseText)
      && secretsAbsentFrom([responseText]),
    'Deletion response exposed an account identity or credential-like value')

    const [deletedAuth, retainedAuth, deletedProfile, deletedLists, deletedPractices,
      deletedConcepts, deletedNotes, deletedNoteReceipts, deletedAppearances, retainedList,
      retainedPractice, retainedRound, retainedAppearance, marker, anonymousRoundsAfter] = await Promise.all([
      admin.auth.admin.getUserById(ids.owner),
      admin.auth.admin.getUserById(ids.other),
      admin.from('profiles').select('id').eq('id', ids.owner),
      admin.from('lists').select('id').eq('owner_id', ids.owner),
      admin.from('practices').select('id').eq('owner_id', ids.owner),
      admin.from('concepts').select('id,list_id'),
      admin.from('practice_notes').select('practice_id'),
      admin.from('practice_note_operations').select('practice_id'),
      admin.from('round_appearances').select('id').eq('round_id', ids.tiedRound),
      other.from('lists').select('id').eq('id', ids.otherList),
      other.from('practices').select('id').eq('id', ids.otherPractice),
      other.from('rounds').select('id').eq('id', ids.otherRound),
      other.from('round_appearances').select('id').eq('round_id', ids.otherRound),
      admin.from('account_deletion_requests').select('state,completed_at').eq('user_id', ids.owner).single(),
      admin.from('rounds').select('id,list_id,anonymous_appearance_total').is('list_id', null).order('id'),
    ])
    requireCondition(deletedAuth.error?.status === 404 && Boolean(retainedAuth.data?.user)
      && requireResult(deletedProfile, 'Deleted profile readback').length === 0
      && requireResult(deletedLists, 'Deleted lists readback').length === 0
      && requireResult(deletedPractices, 'Deleted practices readback').length === 0
      && requireResult(deletedConcepts, 'Deleted concepts readback').filter((concept) => ownerListIds.includes(concept.list_id)).length === 0
      && requireResult(deletedNotes, 'Deleted notes readback').filter((note) => ownerPracticeIds.includes(note.practice_id)).length === 0
      && requireResult(deletedNoteReceipts, 'Deleted note receipts readback').filter((receipt) => ownerPracticeIds.includes(receipt.practice_id)).length === 0
      && requireResult(deletedAppearances, 'Deleted appearances readback').length === 0
      && requireResult(retainedList, 'Other owner list readback').length === 1
      && requireResult(retainedPractice, 'Other owner practice readback').length === 1
      && requireResult(retainedRound, 'Other owner round readback').length === 1
      && requireResult(retainedAppearance, 'Other owner appearance readback').length === 1,
    'Deletion did not remove only owner A Auth/private data or changed owner B data')
    requireCondition(requireResult(marker, 'Completed deletion marker readback').state === 'completed'
      && Boolean(marker.data.completed_at)
      && JSON.stringify(requireResult(anonymousRoundsAfter, 'Anonymous round after deletion')) === JSON.stringify(anonymousRoundsBefore),
    'Deletion did not complete its durable marker or changed pre-existing detached totals')

    console.log('PASS local delete-account function: auth boundary, pending retry, scoped cleanup, owner isolation, completed marker')
  })
  console.log('PASS local delete-account function fixtures cleaned')
} catch (error) {
  const safe = error instanceof VerificationError
  console.error(`FAIL ${safe ? error.message : 'Local delete-account verification failed (details suppressed)'}`)
  process.exitCode = 1
}
