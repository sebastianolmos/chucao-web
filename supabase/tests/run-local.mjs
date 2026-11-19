import { withLocalFixtures, requireCondition, requireResult, inspectPracticeHistoryPagePlan, VerificationError } from './local-fixtures.mjs'

const args = process.argv.slice(2)
if (args.some((arg) => arg !== '--prove-failure') || args.length > 1) {
  console.error('Usage: node supabase/tests/run-local.mjs [--prove-failure]')
  process.exitCode = 1
} else {
  let checks = 0
  async function check(name, assertion) {
    try { await assertion() }
    catch (error) {
      if (error instanceof VerificationError) throw new VerificationError(`${name}: ${error.message}`)
      throw new VerificationError(`${name}: request failed (details suppressed)`)
    }
    checks += 1
    console.log(`PASS ${name}`)
  }

  try {
    await withLocalFixtures(async ({ admin, deleteList, owner, other, anonymous, ids }) => {
      await check('owner reads its existing list', async () => {
        const rows = requireResult(await owner.from('lists').select('id').eq('id', ids.list), 'Owner read')
        requireCondition(rows.length === 1 && rows[0].id === ids.list, 'Owner list read mismatch')
      })
      await check('second authenticated account reads its own list', async () => {
        const rows = requireResult(await other.from('lists').select('id').eq('id', ids.otherList), 'Second owner read')
        requireCondition(rows.length === 1 && rows[0].id === ids.otherList, 'Second owner list read mismatch')
      })
      await check('cross-user list read returns no rows', async () => {
        const rows = requireResult(await other.from('lists').select('id').eq('id', ids.list), 'Cross-user read')
        requireCondition(rows.length === 0, 'Cross-user list disclosure')
      })
      await check('anonymous list read is denied', async () => {
        const result = await anonymous.from('lists').select('id').eq('id', ids.list)
        requireCondition(result.error?.code === '42501', 'Expected anonymous permission denial')
      })
      await check('owner reads representative timer preferences', async () => {
        const row = requireResult(await owner.from('profiles')
          .select('locale,default_timer_minutes,completion_sound_enabled,sound_volume,reduced_motion')
          .eq('id', ids.owner).single(), 'Preference read')
        requireCondition(row.locale === 'es' && row.default_timer_minutes === 5
          && row.completion_sound_enabled === false && row.sound_volume === 25
          && row.reduced_motion === true, 'Preference fixture mismatch')
      })
      await check('owner reads active concept and round', async () => {
        const concepts = requireResult(await owner.from('concepts').select('id').eq('id', ids.activeConcept), 'Concept read')
        const rounds = requireResult(await owner.from('rounds').select('id,status').eq('id', ids.round), 'Round read')
        requireCondition(concepts.length === 1 && rounds.length === 1 && rounds[0].status === 'open', 'Concept/round fixture mismatch')
      })
      await check('ordered appearances include an already-erased legacy title', async () => {
        const rows = requireResult(await owner.from('round_appearances')
          .select('id,appearance_order,origin,title_snapshot,concept_deleted')
          .eq('round_id', ids.round).order('appearance_order'), 'Appearance read')
        requireCondition(rows.length === 2 && rows[0].id === ids.activeAppearance
          && rows[0].origin === 'draw' && rows[0].title_snapshot === 'Synthetic concept'
          && rows[1].id === ids.legacyAppearance && rows[1].origin === 'manual'
          && rows[1].concept_deleted && rows[1].title_snapshot === null, 'Appearance fixture mismatch')
      })
      await check('cross-user round and appearance reads return no rows', async () => {
        const rounds = requireResult(await other.from('rounds').select('id').eq('id', ids.round), 'Cross-user round read')
        const appearances = requireResult(await other.from('round_appearances').select('id').eq('round_id', ids.round), 'Cross-user appearance read')
        requireCondition(rounds.length === 0 && appearances.length === 0, 'Cross-user round disclosure')
      })
      await check('owner reads practice, note and text-free operation receipt', async () => {
        const practice = requireResult(await owner.from('practices').select('id,rating').eq('id', ids.practice), 'Practice read')
        const note = requireResult(await owner.from('practice_notes').select('practice_id,body').eq('practice_id', ids.practice), 'Note read')
        const receipt = requireResult(await owner.from('practice_note_operations').select('practice_id,outcome').eq('practice_id', ids.practice), 'Receipt read')
        requireCondition(practice.length === 1 && practice[0].rating === 0
          && note.length === 1 && note[0].body === 'Synthetic note'
          && receipt.length === 1 && receipt[0].outcome === 'deleted', 'Practice fixture mismatch')
      })
      await check('private practice resources deny other owner and anonymous', async () => {
        for (const table of ['practices', 'practice_notes', 'practice_note_operations']) {
          const otherRows = requireResult(await other.from(table).select('*').eq(
            table === 'practice_note_operations' ? 'practice_id' : table === 'practice_notes' ? 'practice_id' : 'id', ids.practice,
          ), 'Cross-user practice read')
          const anonymousRows = await anonymous.from(table).select('*').eq(
            table === 'practice_note_operations' ? 'practice_id' : table === 'practice_notes' ? 'practice_id' : 'id', ids.practice,
          )
          requireCondition(otherRows.length === 0 && anonymousRows.error?.code === '42501', 'Private practice disclosure')
        }
      })
      await check('clients cannot directly write practice resources', async () => {
        for (const [table, column, value] of [
          ['practices', 'rating', 5], ['practice_notes', 'body', 'changed'],
          ['practice_note_operations', 'outcome', 'stale'],
        ]) {
          const result = await owner.from(table).update({ [column]: value }).eq(
            table === 'practices' ? 'id' : 'practice_id', ids.practice,
          )
          requireCondition(result.error?.code === '42501', 'Direct practice mutation unexpectedly allowed')
        }
        const anonymousResult = await anonymous.from('practices').select('*').eq('id', ids.practice)
        requireCondition(anonymousResult.error?.code === '42501', 'Anonymous practice read unexpectedly allowed')
      })
      await check('database enforces rating, duration and note length constraints', async () => {
        const [{ data: practice }, { data: note }] = await Promise.all([
          admin.from('practices').select('*').eq('id', ids.practice).single(),
          admin.from('practice_notes').select('*').eq('practice_id', ids.practice).single(),
        ])
        const invalidRating = await admin.from('practices').insert({ ...practice, id: crypto.randomUUID(), rating: 6 })
        const invalidDuration = await admin.from('practices').insert({ ...practice, id: crypto.randomUUID(), duration_minutes: 60 })
        const extraPracticeId = crypto.randomUUID()
        requireResult(await admin.from('practices').insert({ ...practice, id: extraPracticeId }), 'Constraint fixture')
        const invalidNote = await admin.from('practice_notes').insert({ ...note, practice_id: extraPracticeId, body: '   ' })
        await admin.from('practices').delete().eq('id', extraPracticeId)
        requireCondition(invalidRating.error?.code === '23514'
          && invalidDuration.error?.code === '23514' && invalidNote.error?.code === '23514',
        'Database did not reject invalid fixture values')
      })
      await check('associated practice save is atomic, owner-scoped and idempotent', async () => {
        const id = crypto.randomUUID()
        const args = {
          p_id: id, p_kind: 'associated', p_list_id: ids.list, p_concept_id: ids.activeConcept,
          p_round_id: ids.round, p_appearance_id: ids.activeAppearance, p_duration_minutes: 5,
          p_completed_at: '2026-01-05T12:00:00Z', p_label: null, p_note: '  café 🐦\n ', p_rating: 0,
        }
        const saved = requireResult(await owner.rpc('save_completed_practice', args), 'Associated practice save')
        requireCondition(saved.practice?.id === id && saved.practice.rating === 0
          && saved.note === '  café 🐦\n ' && saved.replayed === false, 'Associated save response mismatch')
        const replay = requireResult(await owner.rpc('save_completed_practice', args), 'Practice save replay')
        requireCondition(replay.practice?.id === id && replay.replayed === true, 'Practice replay mismatch')
        const conflict = await owner.rpc('save_completed_practice', { ...args, p_rating: 1 })
        requireCondition(conflict.error?.message.includes('practice_identity_conflict'), 'Changed retry payload was not rejected')
        const stored = requireResult(await admin.from('practices').select('id,rating,title_snapshot').eq('id', id), 'Saved practice readback')
        const note = requireResult(await admin.from('practice_notes').select('body').eq('practice_id', id), 'Saved note readback')
        requireCondition(stored.length === 1 && stored[0].rating === 0
          && stored[0].title_snapshot === 'Synthetic concept'
          && note.length === 1 && note[0].body === args.p_note, 'Atomic saved rows mismatch')
        const otherRead = await other.rpc('get_saved_practice', { p_id: id })
        requireCondition(otherRead.error?.message.includes('practice_unavailable'), 'Other owner could read a practice')
        const ownerDetail = requireResult(await owner.rpc('get_saved_practice', { p_id: id }), 'Saved practice detail with note revision')
        requireCondition(ownerDetail.practice?.id === id && ownerDetail.note === args.p_note
          && ownerDetail.note_revision === 1, 'Saved practice detail note revision mismatch')
        const anonymousRead = await anonymous.rpc('get_saved_practice', { p_id: id })
        requireCondition(Boolean(anonymousRead.error), 'Anonymous caller could read a practice')
        const concurrentId = crypto.randomUUID()
        const concurrentArgs = { ...args, p_id: concurrentId, p_completed_at: '2026-01-05T12:30:00Z' }
        const concurrent = await Promise.all([
          owner.rpc('save_completed_practice', concurrentArgs),
          owner.rpc('save_completed_practice', concurrentArgs),
        ])
        const concurrentRows = requireResult(await admin.from('practices').select('id').eq('id', concurrentId), 'Concurrent save readback')
        const replayFlags = concurrent.filter((result) => !result.error).map((result) => result.data?.replayed)
        requireCondition(concurrent.every((result) => !result.error)
          && replayFlags.includes(false) && replayFlags.includes(true)
          && concurrentRows.length === 1, 'Concurrent retry created duplicate or failed to reconcile')
        const invalidId = crypto.randomUUID()
        const rejected = await owner.rpc('save_completed_practice', {
          ...args, p_id: invalidId, p_note: 'n'.repeat(2001),
        })
        const partial = requireResult(await admin.from('practices').select('id').eq('id', invalidId), 'Atomic rejection readback')
        requireCondition(Boolean(rejected.error) && partial.length === 0, 'Invalid save left a partial practice')
      })
      await check('note updates are compare-and-swap, idempotent and preserve practice metadata', async () => {
        const id = crypto.randomUUID()
        const saved = requireResult(await owner.rpc('save_completed_practice', {
          p_id: id, p_kind: 'associated', p_list_id: ids.list, p_concept_id: ids.activeConcept,
          p_round_id: ids.round, p_appearance_id: ids.activeAppearance, p_duration_minutes: 7,
          p_completed_at: '2026-01-05T14:00:00Z', p_label: null, p_note: 'Original private note', p_rating: 4,
        }), 'Note update fixture')
        const emptyOperation = crypto.randomUUID()
        const emptyUpdate = await owner.rpc('update_practice_note', {
          p_practice_id: id, p_operation_id: emptyOperation, p_expected_revision: 1, p_body: '   ',
        })
        const emptyReceipt = requireResult(await admin.from('practice_note_operations').select('operation_id')
          .eq('practice_id', id).eq('operation_id', emptyOperation), 'Empty note edit receipt check')
        const operationId = crypto.randomUUID()
        const update = await owner.rpc('update_practice_note', {
          p_practice_id: id, p_operation_id: operationId, p_expected_revision: 1, p_body: '  Revised note  ',
        })
        const replay = await owner.rpc('update_practice_note', {
          p_practice_id: id, p_operation_id: operationId, p_expected_revision: 1, p_body: '  Revised note  ',
        })
        const conflict = await owner.rpc('update_practice_note', {
          p_practice_id: id, p_operation_id: operationId, p_expected_revision: 1, p_body: 'Different payload',
        })
        const staleId = crypto.randomUUID()
        const stale = await Promise.all([staleId, crypto.randomUUID()].map((operation) => owner.rpc('update_practice_note', {
          p_practice_id: id, p_operation_id: operation, p_expected_revision: 2, p_body: `Concurrent ${operation}`,
        })))
        const outcomes = stale.map((result) => result.data?.outcome).sort()
        const current = requireResult(await admin.from('practice_notes').select('body,revision').eq('practice_id', id).single(), 'Updated note readback')
        const practice = requireResult(await admin.from('practices').select('rating').eq('id', id).single(), 'Practice metadata after note update')
        const concept = requireResult(await admin.from('concepts').select('description').eq('id', ids.activeConcept).single(), 'Concept after note update')
        const receipts = requireResult(await admin.from('practice_note_operations').select('*').eq('practice_id', id), 'Note operation receipts')
        requireCondition(saved.practice?.id === id && update.data?.outcome === 'updated'
          && update.data?.note === '  Revised note  ' && update.data?.revision === 2,
        'Note update did not return the expected new revision')
        requireCondition(emptyUpdate.error?.message.includes('note_input_invalid') && emptyReceipt.length === 0,
          'Empty note edit was accepted or recorded a receipt')
        requireCondition(replay.data?.outcome === 'updated' && replay.data?.note === '  Revised note  '
          && conflict.error?.message.includes('note_operation_conflict'), 'Note operation replay/conflict behavior mismatch')
        requireCondition(outcomes[0] === 'stale' && outcomes[1] === 'updated' && current.revision === 3,
          'Concurrent stale note updates were not serialized')
        requireCondition(practice.rating === 4 && concept.description === '', 'Note update changed unrelated data')
        requireCondition(receipts.every((receipt) => !Object.hasOwn(receipt, 'body') && /^[0-9a-f]{64}$/.test(receipt.request_fingerprint)),
          'Note receipts contain payload data or an invalid fingerprint')
      })
      await check('note deletion replay is text-free and cross-user mutation is denied', async () => {
        const id = crypto.randomUUID()
        await owner.rpc('save_completed_practice', {
          p_id: id, p_kind: 'associated', p_list_id: ids.list, p_concept_id: ids.activeConcept,
          p_round_id: ids.round, p_appearance_id: ids.activeAppearance, p_duration_minutes: 6,
          p_completed_at: '2026-01-05T14:30:00Z', p_label: null, p_note: 'Delete this note', p_rating: 0,
        })
        const denied = await other.rpc('delete_practice_note', {
          p_practice_id: id, p_operation_id: crypto.randomUUID(), p_expected_revision: 1,
        })
        const deniedUpdate = await other.rpc('update_practice_note', {
          p_practice_id: id, p_operation_id: crypto.randomUUID(), p_expected_revision: 1, p_body: 'Cross-user attempt',
        })
        const anonymousDenied = await anonymous.rpc('delete_practice_note', {
          p_practice_id: id, p_operation_id: crypto.randomUUID(), p_expected_revision: 1,
        })
        const operationId = crypto.randomUUID()
        const deleted = await owner.rpc('delete_practice_note', { p_practice_id: id, p_operation_id: operationId, p_expected_revision: 1 })
        const replay = await owner.rpc('delete_practice_note', { p_practice_id: id, p_operation_id: operationId, p_expected_revision: 1 })
        const afterDeleteUpdate = await owner.rpc('update_practice_note', {
          p_practice_id: id, p_operation_id: crypto.randomUUID(), p_expected_revision: 1, p_body: 'Must not recreate',
        })
        const note = requireResult(await admin.from('practice_notes').select('body').eq('practice_id', id), 'Deleted note absence')
        const receipt = requireResult(await admin.from('practice_note_operations').select('*').eq('practice_id', id).eq('operation_id', operationId).single(), 'Delete receipt')
        const practice = requireResult(await admin.from('practices').select('rating').eq('id', id).single(), 'Practice after note deletion')
        requireCondition(denied.error?.message.includes('note_unavailable')
          && deniedUpdate.error?.message.includes('note_unavailable')
          && Boolean(anonymousDenied.error)
          && deleted.data?.outcome === 'deleted' && replay.data?.outcome === 'deleted'
          && afterDeleteUpdate.data?.outcome === 'not_found' && afterDeleteUpdate.data?.note === null
          && replay.data?.note === null && note.length === 0 && practice.rating === 0
          && !Object.hasOwn(receipt, 'body') && !JSON.stringify(receipt).includes('Delete this note'),
        'Note deletion replay exposed content, changed practice, or was not isolated')
      })
      await check('concurrent note update and delete cannot overwrite or recreate a note', async () => {
        const id = crypto.randomUUID()
        await owner.rpc('save_completed_practice', {
          p_id: id, p_kind: 'associated', p_list_id: ids.list, p_concept_id: ids.activeConcept,
          p_round_id: ids.round, p_appearance_id: ids.activeAppearance, p_duration_minutes: 8,
          p_completed_at: '2026-01-05T15:00:00Z', p_label: null, p_note: 'Race note', p_rating: 5,
        })
        const [update, deletion] = await Promise.all([
          owner.rpc('update_practice_note', {
            p_practice_id: id, p_operation_id: crypto.randomUUID(), p_expected_revision: 1, p_body: 'Racing edit',
          }),
          owner.rpc('delete_practice_note', {
            p_practice_id: id, p_operation_id: crypto.randomUUID(), p_expected_revision: 1,
          }),
        ])
        const note = requireResult(await admin.from('practice_notes').select('body,revision').eq('practice_id', id), 'Raced note state')
        const practice = requireResult(await admin.from('practices').select('rating').eq('id', id).single(), 'Practice after update/delete race')
        const deleteFirst = deletion.data?.outcome === 'deleted' && update.data?.outcome === 'not_found'
        const updateFirst = update.data?.outcome === 'updated' && deletion.data?.outcome === 'stale'
        const finalStateMatchesOrder = (deleteFirst && note.length === 0)
          || (updateFirst && note.length === 1 && note[0].body === 'Racing edit' && note[0].revision === 2)
        const outcomes = `update=${update.data?.outcome ?? 'error'}, delete=${deletion.data?.outcome ?? 'error'}`
        requireCondition((deleteFirst || updateFirst) && finalStateMatchesOrder && practice.rating === 5,
          `Update/delete race produced an invalid serialized result (${outcomes}); practice metadata or note state changed`)
      })
      await check('independent practice save requires label and can be unrated without a note', async () => {
        const id = crypto.randomUUID()
        const args = {
          p_id: id, p_kind: 'independent', p_list_id: null, p_concept_id: null,
          p_round_id: null, p_appearance_id: null, p_duration_minutes: 3,
          p_completed_at: '2026-01-05T13:00:00Z', p_label: '  repaso 🐦  ', p_note: null, p_rating: null,
        }
        const missing = await owner.rpc('save_completed_practice', { ...args, p_id: crypto.randomUUID(), p_label: '  ' })
        requireCondition(Boolean(missing.error), 'Whitespace label was accepted')
        const result = requireResult(await owner.rpc('save_completed_practice', args), 'Independent practice save')
        requireCondition(result.practice?.kind === 'independent' && result.practice.independent_label === args.p_label
          && result.practice.rating === null && result.note === null, 'Independent save response mismatch')
        const note = requireResult(await admin.from('practice_notes').select('practice_id').eq('practice_id', id), 'Absent note check')
        requireCondition(note.length === 0, 'Omitted note created a row')
      })
      await check('practice history filters combine, preserve unrated versus zero, and omit note text', async () => {
        const filtered = requireResult(await owner.rpc('list_practice_history', {
          p_from: '2026-01-03T00:00:00Z', p_to_exclusive: '2026-01-04T00:00:00Z',
          p_list_id: ids.list, p_concept_id: ids.activeConcept, p_kind: 'associated',
          p_rating_state: 'rated', p_page_size: 50, p_direction: 'newest',
        }), 'Combined practice history filters')
        requireCondition(filtered.items.length === 1 && filtered.items[0].id === ids.practice
          && filtered.items[0].rating === 0 && filtered.items[0].has_note === true
          && !Object.hasOwn(filtered.items[0], 'note'), 'Combined practice history response mismatch')
        const unrated = requireResult(await owner.rpc('list_practice_history', {
          p_kind: 'independent', p_rating_state: 'unrated', p_page_size: 50,
        }), 'Unrated independent history')
        requireCondition(unrated.items.some((item) => item.kind === 'independent' && item.rating === null),
          'Unrated practice was not distinct from rating zero')
        const literal = requireResult(await owner.rpc('list_practice_history', {
          p_independent_label: '[x] OR true --', p_page_size: 50,
        }), 'Literal independent label filter')
        requireCondition(literal.items.length === 1 && literal.items[0].independent_label === 'Literal [x] OR true --',
          'Independent label punctuation changed the filter query')
      })
      await check('practice history pages are stable, bounded and owner-private at 1,000 records', async () => {
        const first = requireResult(await owner.rpc('list_practice_history', {
          p_page_size: 500, p_direction: 'newest',
        }), 'First bounded history page')
        requireCondition(first.items.length === 100 && first.has_more === true
          && first.next_cursor?.id === first.items.at(-1)?.id,
        'History page did not enforce the 100 item cap or return its cursor')
        const second = requireResult(await owner.rpc('list_practice_history', {
          p_page_size: 100, p_direction: 'newest',
          p_cursor_completed_at: first.next_cursor.timestamp, p_cursor_id: first.next_cursor.id,
        }), 'Second stable history page')
        const firstIds = new Set(first.items.map((item) => item.id))
        requireCondition(second.items.length === 100 && second.items.every((item) => !firstIds.has(item.id)),
          'Stable history pagination repeated records')
        requireCondition(first.items.at(-1).completed_at === second.items[0].completed_at,
          'History page boundary did not exercise an equal-timestamp cursor')
        const oldest = requireResult(await owner.rpc('list_practice_history', {
          p_page_size: 100, p_direction: 'oldest',
        }), 'Oldest practice history page')
        requireCondition(oldest.items.length === 100 && oldest.items[0].completed_at < first.items[0].completed_at,
          'Oldest-first practice history order was not applied')
        const crossUser = requireResult(await other.rpc('list_practice_history', { p_page_size: 100 }), 'Cross-user practice history')
        requireCondition(crossUser.items.length === 1 && crossUser.items[0].id === ids.otherPractice,
          'Practice history disclosed another owner or omitted the caller record')
        const anonymousResult = await anonymous.rpc('list_practice_history', { p_page_size: 100 })
        requireCondition(Boolean(anonymousResult.error), 'Anonymous practice history was readable')
      })
      await check('1,000-record history workload has a bounded database page plan', async () => {
        const plan = inspectPracticeHistoryPagePlan(ids.owner)
        requireCondition(plan.bounded, 'History page plan omitted its row limit')
        console.log(`INFO history index used: ${plan.usesHistoryIndex}`)
      })
      await check('round history returns only the owner metadata page', async () => {
        const ownerPage = requireResult(await owner.rpc('list_round_history', {
          p_list_id: ids.list, p_page_size: 1, p_direction: 'newest',
        }), 'Owner round history')
        const next = requireResult(await owner.rpc('list_round_history', {
          p_list_id: ids.list, p_page_size: 1, p_direction: 'newest',
          p_cursor_opened_at: ownerPage.next_cursor?.timestamp, p_cursor_id: ownerPage.next_cursor?.id,
        }), 'Next owner round history page')
        requireCondition(ownerPage.items.length === 1 && ownerPage.has_more === true
          && !Object.hasOwn(ownerPage.items[0], 'appearances') && next.items.length === 1
          && next.items[0].id !== ownerPage.items[0].id
          && next.items[0].opened_at === ownerPage.items[0].opened_at,
        'Round metadata page embedded appearances or repeated an equal-timestamp round')
      })
      await check('round appearance detail is ordered and private', async () => {
        const appearances = requireResult(await owner.rpc('list_round_appearances', { p_round_ids: [ids.round] }), 'Owner round appearances')
        requireCondition(appearances.length === 1 && appearances[0].appearances.map((a) => a.appearance_order).join(',') === '1,2'
          && appearances[0].appearances[1].title_snapshot === null && appearances[0].appearances[1].concept_deleted,
        'Round appearance order or legacy deleted title was not preserved')
        const crossUser = await other.rpc('list_round_appearances', { p_round_ids: [ids.round] })
        const anonymousResult = await anonymous.rpc('list_round_appearances', { p_round_ids: [ids.round] })
        requireCondition(Boolean(crossUser.error) && Boolean(anonymousResult.error), 'Round appearance details crossed an owner boundary')
      })
      await check('round history does not create a current round', async () => {
        const before = requireResult(await admin.from('rounds').select('id').eq('list_id', ids.workloadLists[1]), 'No-round fixture readback')
        const noRoundPage = requireResult(await owner.rpc('list_round_history', { p_list_id: ids.workloadLists[1] }), 'No-round list history')
        const after = requireResult(await admin.from('rounds').select('id').eq('list_id', ids.workloadLists[1]), 'No-round fixture readback after history')
        requireCondition(noRoundPage.items.length === 0 && before.length === 0 && after.length === 0,
          'History read created a current round')
      })
      await check('concept deletion preserves its title snapshot and saved practice', async () => {
        const concept = requireResult(await admin.from('concepts').select('updated_at')
          .eq('id', ids.activeConcept).single(), 'Concept version read')
        const deletion = await owner.rpc('delete_concept', {
          p_concept_id: ids.activeConcept, p_expected_updated_at: concept.updated_at,
        })
        requireCondition(!deletion.error, 'Synthetic concept deletion failed')
        const [appearance, tombstone, practice, note, noteDetail, history] = await Promise.all([
          admin.from('round_appearances').select('title_snapshot,concept_deleted').eq('id', ids.activeAppearance).single(),
          admin.from('concepts').select('title,description,deleted_at').eq('id', ids.activeConcept).single(),
          admin.from('practices').select('id,concept_id,title_snapshot').eq('id', ids.practice).single(),
          admin.from('practice_notes').select('body').eq('practice_id', ids.practice).single(),
          owner.rpc('get_saved_practice', { p_id: ids.practice }),
          owner.rpc('list_practice_history', { p_list_id: ids.list, p_kind: 'associated', p_page_size: 50 }),
        ])
        requireCondition(appearance.data?.title_snapshot === 'Synthetic concept' && appearance.data?.concept_deleted
          && tombstone.data?.title === null && tombstone.data?.description === null && tombstone.data?.deleted_at
          && practice.data?.concept_id === ids.activeConcept && practice.data?.title_snapshot === 'Synthetic concept'
          && note.data?.body === 'Synthetic note'
          && noteDetail.data?.note === 'Synthetic note' && noteDetail.data?.note_revision === 1
          && history.data?.items.some((item) => item.id === ids.practice && item.has_note
            && item.title_snapshot === 'Synthetic concept'), 'Concept deletion damaged list-context note history')
      })
      await check('list deletion removes authored practice data and preserves anonymous totals', async () => {
        const anonymousRoundId = ids.round
        // The app intentionally has no list-delete API. Use the local DB CLI
        // against this tracked synthetic UUID to exercise FK and trigger behavior.
        deleteList(ids.list)
        const [practices, notes, receipts, totals, visibleTotals] = await Promise.all([
          admin.from('practices').select('id').eq('id', ids.practice),
          admin.from('practice_notes').select('practice_id').eq('practice_id', ids.practice),
          admin.from('practice_note_operations').select('practice_id').eq('practice_id', ids.practice),
          admin.from('rounds').select('id,list_id,anonymous_appearance_total').eq('id', anonymousRoundId),
          owner.from('rounds').select('id').eq('id', anonymousRoundId),
        ])
        requireCondition(requireResult(practices, 'Deleted practice check').length === 0
          && requireResult(notes, 'Deleted note check').length === 0
          && requireResult(receipts, 'Deleted receipt check').length === 0,
        'List deletion retained authored practice resources')
        const remainingTotal = requireResult(totals, 'Anonymous total check')
        requireCondition(remainingTotal.length === 1 && remainingTotal[0].list_id === null
          && remainingTotal[0].anonymous_appearance_total === 2
          && requireResult(visibleTotals, 'Anonymous visibility check').length === 0,
        'Anonymous aggregate was lost or exposed')
      })
      await check('account deletion cascades its private resources', async () => {
        requireResult(await admin.auth.admin.deleteUser(ids.other), 'Second account deletion')
        const [profile, list, practice, note, receipt, detachedRound, appearances, visibleRound] = await Promise.all([
          admin.from('profiles').select('id').eq('id', ids.other),
          admin.from('lists').select('id').eq('id', ids.otherList),
          admin.from('practices').select('id').eq('id', ids.otherPractice),
          admin.from('practice_notes').select('practice_id').eq('practice_id', ids.otherPractice),
          admin.from('practice_note_operations').select('practice_id').eq('practice_id', ids.otherPractice),
          admin.from('rounds').select('id,list_id,status,created_at,opened_at,closed_at,anonymous_appearance_total').eq('id', ids.otherRound).single(),
          admin.from('round_appearances').select('id').eq('round_id', ids.otherRound),
          other.from('rounds').select('id').eq('id', ids.otherRound),
        ])
        requireCondition(requireResult(profile, 'Deleted profile check').length === 0
          && requireResult(list, 'Deleted list check').length === 0
          && requireResult(practice, 'Deleted practice check').length === 0
          && requireResult(note, 'Deleted note check').length === 0
          && requireResult(receipt, 'Deleted receipt check').length === 0,
        'Account deletion retained private resources')
        const total = requireResult(detachedRound, 'Account deletion anonymous total check')
        requireCondition(total.list_id === null && total.status === 'closed'
          && total.created_at === null && total.opened_at === null && total.closed_at === null
          && total.anonymous_appearance_total === 1
          && requireResult(appearances, 'Account deletion appearance cleanup').length === 0
          && requireResult(visibleRound, 'Account deletion history isolation').length === 0,
        'Account deletion did not preserve only an inaccessible anonymous total')
      })
      if (args.includes('--prove-failure')) {
        requireCondition(false, 'Intentional assertion failure (failure-propagation probe)')
      }
    })
    requireCondition(checks > 0, 'No checks executed')
    console.log(`PASS ${checks} database checks; no mocks; cleanup verified`)
  } catch (error) {
    // Only our fixed messages are safe; unexpected fetch/SDK errors stay private.
    const safe = error instanceof VerificationError
    console.error(`FAIL ${safe ? error.message : 'Local verification failed (details suppressed)'}`)
    console.error(`${checks} database checks completed; run not successful`)
    process.exitCode = 1
  }
}
