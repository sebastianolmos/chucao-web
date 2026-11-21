import { randomUUID } from 'node:crypto'
import { withLocalFixtures, requireCondition, requireResult, inspectPracticeHistoryPagePlan, VerificationError } from './local-fixtures.mjs'

function listPageArgs(collection, search = null, sort = 'name_asc', pageSize = 101, cursor = null) {
  return {
    p_collection: collection,
    p_search: search,
    p_sort: sort,
    p_cursor_name: cursor?.name_normalized ?? null,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_updated_at: cursor?.updated_at ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_page_size: pageSize,
  }
}

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
    await withLocalFixtures(async ({ admin, owner, other, anonymous, ids, trackList, trackRound,
      trackAppearance, addActiveCapacityFixtures }) => {
      await check('owner reads its existing list', async () => {
        const rows = requireResult(await owner.from('lists').select('id').eq('id', ids.list), 'Owner read')
        requireCondition(rows.length === 1 && rows[0].id === ids.list, 'Owner list read mismatch')
      })
      await check('rename validates names and enforces the authenticated owner', async () => {
        const renamed = requireResult(await owner.rpc('rename_private_list', {
          p_list_id: ids.collectionLists.biologyOne, p_name: '  Biología renovada  ',
        }), 'Owner rename')
        requireCondition(renamed.id === ids.collectionLists.biologyOne
          && renamed.owner_id === ids.owner && renamed.name === 'Biología renovada'
          && renamed.name_normalized === 'biología renovada', 'Rename changed identity or ignored trimming')

        for (const name of ['', ' '.repeat(2), 'x'.repeat(81)]) {
          const invalid = await owner.rpc('rename_private_list', {
            p_list_id: ids.collectionLists.biologyOne, p_name: name,
          })
          requireCondition(invalid.error?.code === '22023', 'Invalid name was accepted')
        }
        for (const name of ['BIOLOGIA avanzada', '  BIOLOGIA AVANZADA  ']) {
          const duplicate = await owner.rpc('rename_private_list', {
            p_list_id: ids.collectionLists.biologyOne, p_name: name,
          })
          requireCondition(duplicate.error?.code === '23505', 'Case-folded duplicate name was accepted')
        }
        const crossOwner = await other.rpc('rename_private_list', {
          p_list_id: ids.collectionLists.biologyOne, p_name: 'Cross owner',
        })
        const anonymousResult = await anonymous.rpc('rename_private_list', {
          p_list_id: ids.collectionLists.biologyOne, p_name: 'Anonymous',
        })
        requireCondition(Boolean(crossOwner.error) && Boolean(anonymousResult.error),
          'Unauthorized rename unexpectedly succeeded')
        const unchanged = requireResult(await owner.from('lists').select('name').eq('id', ids.collectionLists.biologyOne).single(), 'Rename readback')
        requireCondition(unchanged.name === 'Biología renovada', 'Rejected rename changed the stored name')
      })
      await check('create counts only active rows despite a large archive', async () => {
        const created = requireResult(await owner.rpc('create_private_list', { p_name: `Active with archive ${ids.run}` }), 'Create with archived workload')
        ids.createdWithArchive = created.id
        trackList(created.id)
        requireCondition(created.owner_id === ids.owner && created.archived_at === null,
          'Create with archived workload did not return a new active owned list')
      })
      await check('archive and restore preserve linked content and history', async () => {
        const before = {
          concepts: requireResult(await owner.from('concepts').select('id,title,description,state,position,deleted_at').eq('list_id', ids.list).order('id'), 'Concept snapshot'),
          rounds: requireResult(await owner.from('rounds').select('id,status,opened_at,closed_at').eq('list_id', ids.list).order('id'), 'Round snapshot'),
          practices: requireResult(await owner.from('practices').select('id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,duration_minutes,completed_at,rating').eq('list_id', ids.list).order('id'), 'Practice snapshot'),
          notes: requireResult(await owner.from('practice_notes').select('practice_id,body,revision').eq('practice_id', ids.practice), 'Note snapshot'),
          noteOperations: requireResult(await admin.from('practice_note_operations').select('owner_id,practice_id,operation_id,operation_kind,expected_revision,resulting_revision,outcome').eq('practice_id', ids.practice), 'Note operation snapshot'),
          appearances: requireResult(await owner.from('round_appearances').select('id,round_id,concept_id,appearance_order,origin,title_snapshot,concept_deleted').eq('round_id', ids.round).order('appearance_order'), 'History snapshot'),
          roundOperations: requireResult(await admin.from('round_operations').select('list_id,operation_id,round_id,action,outcome,appearance_id,concept_id,result_state').eq('list_id', ids.list), 'Round operation snapshot'),
        }
        const crossOwnerArchive = await other.rpc('archive_private_list', { p_list_id: ids.list })
        const anonymousArchive = await anonymous.rpc('archive_private_list', { p_list_id: ids.list })
        requireCondition(Boolean(crossOwnerArchive.error) && Boolean(anonymousArchive.error),
          'Unauthorized archive unexpectedly succeeded')
        const stillActive = requireResult(await owner.from('lists').select('archived_at').eq('id', ids.list).single(), 'Unauthorized archive readback')
        requireCondition(stillActive.archived_at === null, 'Unauthorized archive changed list state')
        const archived = requireResult(await owner.rpc('archive_private_list', { p_list_id: ids.list }), 'Archive list')
        requireCondition(archived.archived_at !== null && archived.id === ids.list, 'Archive did not mark the owned list')
        const archiveReplay = requireResult(await owner.rpc('archive_private_list', { p_list_id: ids.list }), 'Archive replay')
        requireCondition(archiveReplay.archived_at === archived.archived_at, 'Archive replay created another transition')
        const crossOwnerRestore = await other.rpc('restore_private_list', { p_list_id: ids.list })
        const anonymousRestore = await anonymous.rpc('restore_private_list', { p_list_id: ids.list })
        requireCondition(Boolean(crossOwnerRestore.error) && Boolean(anonymousRestore.error),
          'Unauthorized restore unexpectedly succeeded')
        const stillArchived = requireResult(await owner.from('lists').select('archived_at').eq('id', ids.list).single(), 'Unauthorized restore readback')
        requireCondition(stillArchived.archived_at !== null, 'Unauthorized restore changed list state')
        const restored = requireResult(await owner.rpc('restore_private_list', { p_list_id: ids.list }), 'Restore below capacity')
        requireCondition(restored.archived_at === null && restored.id === ids.list, 'Restore below capacity failed')
        const restoreReplay = requireResult(await owner.rpc('restore_private_list', { p_list_id: ids.list }), 'Restore replay')
        requireCondition(restoreReplay.updated_at === restored.updated_at, 'Restore replay created another transition')
        const after = {
          concepts: requireResult(await owner.from('concepts').select('id,title,description,state,position,deleted_at').eq('list_id', ids.list).order('id'), 'Concept readback'),
          rounds: requireResult(await owner.from('rounds').select('id,status,opened_at,closed_at').eq('list_id', ids.list).order('id'), 'Round readback'),
          practices: requireResult(await owner.from('practices').select('id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,duration_minutes,completed_at,rating').eq('list_id', ids.list).order('id'), 'Practice readback'),
          notes: requireResult(await owner.from('practice_notes').select('practice_id,body,revision').eq('practice_id', ids.practice), 'Note readback'),
          noteOperations: requireResult(await admin.from('practice_note_operations').select('owner_id,practice_id,operation_id,operation_kind,expected_revision,resulting_revision,outcome').eq('practice_id', ids.practice), 'Note operation readback'),
          appearances: requireResult(await owner.from('round_appearances').select('id,round_id,concept_id,appearance_order,origin,title_snapshot,concept_deleted').eq('round_id', ids.round).order('appearance_order'), 'History readback'),
          roundOperations: requireResult(await admin.from('round_operations').select('list_id,operation_id,round_id,action,outcome,appearance_id,concept_id,result_state').eq('list_id', ids.list), 'Round operation readback'),
        }
        requireCondition(JSON.stringify(after) === JSON.stringify(before), 'Archive/restore changed linked list content or history')
      })
      await check('restore at 100 active lists rejects atomically and create uses the same cap', async () => {
        await addActiveCapacityFixtures()
        const archived = requireResult(await owner.rpc('archive_private_list', { p_list_id: ids.list }), 'Archive capacity target')
        requireCondition(archived.archived_at !== null, 'Capacity target was not archived')
        const fillSlot = requireResult(await owner.rpc('create_private_list', { p_name: `Cap replacement ${ids.run}` }), 'Create into freed slot')
        trackList(fillSlot.id)
        const before = requireResult(await owner.from('lists').select('id,owner_id,name,name_normalized,archived_at').eq('id', ids.list).single(), 'At-cap archived list snapshot')
        const linkedBefore = {
          concepts: requireResult(await owner.from('concepts').select('id,title,description,state,position,deleted_at').eq('list_id', ids.list).order('id'), 'At-cap concept snapshot'),
          rounds: requireResult(await owner.from('rounds').select('id,status,opened_at,closed_at').eq('list_id', ids.list).order('id'), 'At-cap round snapshot'),
          practices: requireResult(await owner.from('practices').select('id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,duration_minutes,completed_at,rating').eq('list_id', ids.list).order('id'), 'At-cap practice snapshot'),
          notes: requireResult(await owner.from('practice_notes').select('practice_id,body,revision').eq('practice_id', ids.practice), 'At-cap note snapshot'),
          noteOperations: requireResult(await admin.from('practice_note_operations').select('owner_id,practice_id,operation_id,operation_kind,expected_revision,resulting_revision,outcome').eq('practice_id', ids.practice), 'At-cap note operation snapshot'),
          appearances: requireResult(await owner.from('round_appearances').select('id,round_id,concept_id,appearance_order,origin,title_snapshot,concept_deleted').eq('round_id', ids.round).order('appearance_order'), 'At-cap appearance snapshot'),
          roundOperations: requireResult(await admin.from('round_operations').select('list_id,operation_id,round_id,action,outcome,appearance_id,concept_id,result_state').eq('list_id', ids.list), 'At-cap round operation snapshot'),
        }
        const rejected = await owner.rpc('restore_private_list', { p_list_id: ids.list })
        requireCondition(rejected.error?.message?.includes('list_limit_reached'), 'Restore at capacity was not rejected by the active-list limit')
        const after = requireResult(await owner.from('lists').select('id,owner_id,name,name_normalized,archived_at').eq('id', ids.list).single(), 'At-cap list readback')
        const linkedAfter = {
          concepts: requireResult(await owner.from('concepts').select('id,title,description,state,position,deleted_at').eq('list_id', ids.list).order('id'), 'At-cap concept readback'),
          rounds: requireResult(await owner.from('rounds').select('id,status,opened_at,closed_at').eq('list_id', ids.list).order('id'), 'At-cap round readback'),
          practices: requireResult(await owner.from('practices').select('id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,duration_minutes,completed_at,rating').eq('list_id', ids.list).order('id'), 'At-cap practice readback'),
          notes: requireResult(await owner.from('practice_notes').select('practice_id,body,revision').eq('practice_id', ids.practice), 'At-cap note readback'),
          noteOperations: requireResult(await admin.from('practice_note_operations').select('owner_id,practice_id,operation_id,operation_kind,expected_revision,resulting_revision,outcome').eq('practice_id', ids.practice), 'At-cap note operation readback'),
          appearances: requireResult(await owner.from('round_appearances').select('id,round_id,concept_id,appearance_order,origin,title_snapshot,concept_deleted').eq('round_id', ids.round).order('appearance_order'), 'At-cap appearance readback'),
          roundOperations: requireResult(await admin.from('round_operations').select('list_id,operation_id,round_id,action,outcome,appearance_id,concept_id,result_state').eq('list_id', ids.list), 'At-cap round operation readback'),
        }
        requireCondition(JSON.stringify(after) === JSON.stringify(before) && JSON.stringify(linkedAfter) === JSON.stringify(linkedBefore),
          'Rejected restore changed the archived list or linked data')
        const createAtCap = await owner.rpc('create_private_list', { p_name: `Beyond cap ${ids.run}` })
        requireCondition(createAtCap.error?.message?.includes('list_limit_reached'), 'Create at 100 active lists was accepted')

        const freed = requireResult(await owner.rpc('archive_private_list', { p_list_id: ids.workloadLists[1] }), 'Free concurrent restore slot')
        requireCondition(freed.archived_at !== null, 'Could not prepare concurrent restore scenario')
        const [restoreMain, restoreCollection] = await Promise.all([
          owner.rpc('restore_private_list', { p_list_id: ids.list }),
          owner.rpc('restore_private_list', { p_list_id: ids.collectionLists.biologyArchived }),
        ])
        const outcomes = [restoreMain, restoreCollection]
        requireCondition(outcomes.filter((result) => !result.error).length === 1
          && outcomes.filter((result) => result.error?.message?.includes('list_limit_reached')).length === 1,
        'Concurrent restores did not serialize at the active-list capacity')
        const activeAfterRace = requireResult(await admin.from('lists').select('id')
          .eq('owner_id', ids.owner).is('archived_at', null), 'Concurrent restore active count')
        requireCondition(activeAfterRace.length === 100, 'Concurrent restore exceeded or underfilled the active-list limit')

        const archivedCollection = requireResult(await owner.rpc('archive_private_list', {
          p_list_id: ids.collectionLists.biologyArchived,
        }), 'Rearchive collection search fixture')
        const restoredMain = requireResult(await owner.rpc('restore_private_list', {
          p_list_id: ids.list,
        }), 'Restore main fixture after concurrent restore')
        requireCondition(archivedCollection.archived_at !== null && restoredMain.archived_at === null,
          'Concurrent restore fixtures did not return to their expected collections')
      })
      await check('duplicate copies only active content with fresh progress and reconciles retries', async () => {
        const source = requireResult(await owner.rpc('archive_private_list', { p_list_id: ids.list }), 'Archive duplicate source')
        requireCondition(source.archived_at !== null, 'Duplicate source was not archived')
        await addActiveCapacityFixtures()
        const atCapacityName = `Duplicate rejected at cap ${ids.run}`
        const atCapacityOperationId = randomUUID()
        const atCapacity = await owner.rpc('duplicate_private_list', {
          p_source_list_id: ids.list, p_operation_id: atCapacityOperationId, p_name: atCapacityName,
        })
        requireCondition(atCapacity.error?.message?.includes('list_limit_reached'),
          'Duplicate at capacity did not return the active-list limit rejection')
        const absentAtCapacity = requireResult(await owner.from('lists').select('id').eq('owner_id', ids.owner).eq('name', atCapacityName), 'Rejected duplicate readback')
        const absentReceipt = requireResult(await admin.from('list_duplicate_operations').select('operation_id')
          .eq('owner_id', ids.owner).eq('operation_id', atCapacityOperationId), 'Rejected duplicate receipt readback')
        requireCondition(absentAtCapacity.length === 0 && absentReceipt.length === 0,
          'Rejected duplicate created a partial list or retry receipt')

        const freed = requireResult(await owner.rpc('archive_private_list', { p_list_id: ids.workloadLists[2] }), 'Free duplicate capacity slot')
        requireCondition(freed.archived_at !== null, 'Could not prepare duplicate capacity scenario')
        const name = `Synthetic copied source ${ids.run.slice(0, 8)}`
        const operationId = randomUUID()
        const sourceBefore = {
          list: requireResult(await owner.from('lists').select('id,owner_id,name,name_normalized,archived_at').eq('id', ids.list).single(), 'Duplicate source snapshot'),
          concepts: requireResult(await owner.from('concepts').select('id,title,description,state,position,deleted_at').eq('list_id', ids.list).order('position,id'), 'Duplicate source concepts'),
          rounds: requireResult(await owner.from('rounds').select('id,list_id,status,opened_at,closed_at').eq('list_id', ids.list).order('id'), 'Duplicate source rounds'),
          practices: requireResult(await owner.from('practices').select('id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,duration_minutes,completed_at,rating').eq('list_id', ids.list).order('id'), 'Duplicate source practices'),
          notes: requireResult(await owner.from('practice_notes').select('practice_id,body,revision').eq('practice_id', ids.practice), 'Duplicate source note'),
          appearances: requireResult(await owner.from('round_appearances').select('id,round_id,concept_id,appearance_order,origin,title_snapshot,concept_deleted').eq('round_id', ids.round).order('appearance_order'), 'Duplicate source history'),
        }
        const [crossOwner, anonymousResult] = await Promise.all([
          other.rpc('duplicate_private_list', { p_source_list_id: ids.list, p_operation_id: operationId, p_name: name }),
          anonymous.rpc('duplicate_private_list', { p_source_list_id: ids.list, p_operation_id: operationId, p_name: name }),
        ])
        requireCondition(Boolean(crossOwner.error) && Boolean(anonymousResult.error), 'Unauthorized duplicate unexpectedly succeeded')

        for (const invalidName of ['', ' '.repeat(2), 'x'.repeat(81)]) {
          const invalid = await owner.rpc('duplicate_private_list', {
            p_source_list_id: ids.list, p_operation_id: randomUUID(), p_name: invalidName,
          })
          requireCondition(invalid.error?.code === '22023', 'Invalid copy name was not rejected by name validation')
        }
        for (const duplicateName of ['fixture 0', '  FIXTURE 0  ']) {
          const duplicate = await owner.rpc('duplicate_private_list', {
            p_source_list_id: ids.list, p_operation_id: randomUUID(), p_name: duplicateName,
          })
          requireCondition(duplicate.error?.code === '23505', 'Case-folded duplicate copy name was accepted')
        }
        const first = requireResult(await owner.rpc('duplicate_private_list', {
          p_source_list_id: ids.list, p_operation_id: operationId, p_name: `  ${name}  `,
        }), 'Duplicate archived source')
        trackList(first.id)
        const retry = requireResult(await owner.rpc('duplicate_private_list', {
          p_source_list_id: ids.list, p_operation_id: operationId, p_name: name,
        }), 'Duplicate retry reconciliation')
        requireCondition(first.id !== ids.list && first.owner_id === ids.owner && first.name === name
          && retry.id === first.id, 'Duplicate retry created a second list or changed the result identity')
        ids.duplicateListId = first.id
        const changedRequest = await owner.rpc('duplicate_private_list', {
          p_source_list_id: ids.list, p_operation_id: operationId, p_name: `${name} changed`,
        })
        requireCondition(changedRequest.error?.message?.includes('duplicate_operation_conflict'),
          'Reused operation identity with different input was not rejected')
        const privateReceipt = requireResult(await admin.from('list_duplicate_operations').select('*')
          .eq('owner_id', ids.owner).eq('operation_id', operationId).single(), 'Duplicate operation receipt')
        const clientReceiptRead = await owner.from('list_duplicate_operations').select('*').eq('operation_id', operationId)
        const receiptFields = ['created_at', 'operation_id', 'owner_id', 'request_fingerprint', 'result_list_id', 'source_list_id']
        requireCondition(Object.keys(privateReceipt).sort().join(',') === receiptFields.join(',')
          && !Object.hasOwn(privateReceipt, 'name') && clientReceiptRead.error?.code === '42501',
        'Duplicate retry receipt retained authored name text or was client-readable')

        const copiedConcepts = requireResult(await owner.from('concepts')
          .select('id,title,description,state,position,deleted_at').eq('list_id', first.id).order('position,id'), 'Copied concepts')
        const copiedRounds = requireResult(await owner.from('rounds').select('id').eq('list_id', first.id), 'Copied rounds')
        const copiedPractices = requireResult(await owner.from('practices').select('id').eq('list_id', first.id), 'Copied practices')
        const copiedOperations = requireResult(await admin.from('round_operations').select('operation_id').eq('list_id', first.id), 'Copied round receipts')
        const copiedPracticeIds = new Set(copiedPractices.map((practice) => practice.id))
        const allNotes = requireResult(await admin.from('practice_notes').select('practice_id'), 'Copy note inspection')
        const allNoteReceipts = requireResult(await admin.from('practice_note_operations').select('practice_id'), 'Copy note receipt inspection')
        const copiedAppearanceRoundIds = new Set(copiedRounds.map((round) => round.id))
        const allAppearances = requireResult(await admin.from('round_appearances').select('round_id'), 'Copy appearance inspection')
        requireCondition(copiedConcepts.length === 1
          && copiedConcepts[0].id !== ids.activeConcept
          && copiedConcepts[0].title === 'Synthetic concept'
          && copiedConcepts[0].description === 'Synthetic source description'
          && copiedConcepts[0].state === 'pending' && copiedConcepts[0].position === 1
          && copiedConcepts[0].deleted_at === null,
        'Duplicate did not copy active concept content with a fresh identity and pending progress')
        requireCondition(copiedRounds.length === 0 && copiedPractices.length === 0 && copiedOperations.length === 0
          && !allNotes.some((note) => copiedPracticeIds.has(note.practice_id))
          && !allNoteReceipts.some((receipt) => copiedPracticeIds.has(receipt.practice_id))
          && !allAppearances.some((appearance) => copiedAppearanceRoundIds.has(appearance.round_id)),
        'Duplicate copied round, practice, note, or history data')
        const sourceAfter = {
          list: requireResult(await owner.from('lists').select('id,owner_id,name,name_normalized,archived_at').eq('id', ids.list).single(), 'Duplicate source readback'),
          concepts: requireResult(await owner.from('concepts').select('id,title,description,state,position,deleted_at').eq('list_id', ids.list).order('position,id'), 'Duplicate source concepts readback'),
          rounds: requireResult(await owner.from('rounds').select('id,list_id,status,opened_at,closed_at').eq('list_id', ids.list).order('id'), 'Duplicate source rounds readback'),
          practices: requireResult(await owner.from('practices').select('id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,duration_minutes,completed_at,rating').eq('list_id', ids.list).order('id'), 'Duplicate source practices readback'),
          notes: requireResult(await owner.from('practice_notes').select('practice_id,body,revision').eq('practice_id', ids.practice), 'Duplicate source note readback'),
          appearances: requireResult(await owner.from('round_appearances').select('id,round_id,concept_id,appearance_order,origin,title_snapshot,concept_deleted').eq('round_id', ids.round).order('appearance_order'), 'Duplicate source history readback'),
        }
        requireCondition(JSON.stringify(sourceAfter) === JSON.stringify(sourceBefore), 'Duplicate changed its source list or history')
        const archivedCopy = requireResult(await owner.rpc('archive_private_list', { p_list_id: first.id }), 'Archive duplicate copy')
        const restoredSource = requireResult(await owner.rpc('restore_private_list', { p_list_id: ids.list }), 'Restore duplicate source')
        requireCondition(archivedCopy.archived_at !== null && restoredSource.archived_at === null,
          'Could not return T04 fixtures to their pre-check state')
      })
      await check('owned list collection uses a bounded database page', async () => {
        const rows = requireResult(await owner.rpc('list_owned_lists', {
          p_collection: 'active', p_search: null, p_sort: 'name_asc',
          p_cursor_name: null, p_cursor_created_at: null, p_cursor_updated_at: null,
          p_cursor_id: null, p_page_size: 10,
        }), 'Owned list page')
        requireCondition(rows.length >= 1 && rows.length <= 10
          && rows.every((row) => row.owner_id === ids.owner && row.archived_at === null),
        'Owned active list page was not owner-scoped and bounded')
      })
      await check('list collection search is trimmed, accent-insensitive and scoped', async () => {
        const active = requireResult(await owner.rpc('list_owned_lists',
          listPageArgs('active', '  bIoLo  ', 'name_asc', 10)), 'Active partial search')
        const archived = requireResult(await owner.rpc('list_owned_lists',
          listPageArgs('archived', 'BIOLO', 'name_asc', 10)), 'Archived partial search')
        const accentedQuery = requireResult(await owner.rpc('list_owned_lists',
          listPageArgs('active', 'BIOLOGÍA', 'name_asc', 10)), 'Accent-normalized query')
        requireCondition(active.map((row) => row.id).sort().join(',')
          === [ids.collectionLists.biologyOne, ids.collectionLists.biologyTwo, ids.trustedSearchList].sort().join(',')
          && active.every((row) => row.archived_at === null), 'Active accent-insensitive search mismatch')
        requireCondition(archived.length === 1 && archived[0].id === ids.collectionLists.biologyArchived
          && archived[0].archived_at !== null, 'Archived collection search leaked other states')
        requireCondition(accentedQuery.length === 3, 'Accented query did not match unaccented names')
      })
      await check('list ordering is allowlisted and deterministic for every option', async () => {
        const orders = [
          ['name_asc', ['Sort Alpha', 'Sort Bravo', 'Sort Charlie']],
          ['name_desc', ['Sort Charlie', 'Sort Bravo', 'Sort Alpha']],
          ['created_newest', ['Sort Charlie', 'Sort Alpha', 'Sort Bravo']],
          ['created_oldest', ['Sort Alpha', 'Sort Bravo', 'Sort Charlie']],
          ['modified_newest', ['Sort Bravo', 'Sort Alpha', 'Sort Charlie']],
        ]
        for (const [sort, expectedNames] of orders) {
          const rows = requireResult(await owner.rpc('list_owned_lists',
            listPageArgs('active', 'Sort', sort, 3)), `List order ${sort}`)
          const next = requireResult(await owner.rpc('list_owned_lists',
            listPageArgs('active', 'Sort', sort, 10, rows[1])), `List order cursor ${sort}`)
          requireCondition(rows.map((row) => row.name).join('|') === expectedNames.join('|')
            && next.length === 1 && next[0].name === expectedNames[2],
          `Unexpected order or cursor boundary for ${sort}`)
        }
        const invalid = await owner.rpc('list_owned_lists', listPageArgs('active', null, 'created_at desc; select', 10))
        requireCondition(invalid.error?.code === '22023', 'Unsafe sort value was not rejected')
      })
      await check('search treats wildcard and SQL punctuation as literal text', async () => {
        const rows = requireResult(await owner.rpc('list_owned_lists',
          listPageArgs('active', "%_ ' OR true --", 'name_asc', 10)), 'Literal punctuation search')
        requireCondition(rows.length === 1 && rows[0].id === ids.collectionLists.literalSearch,
          'Search punctuation changed matching or query behavior')
      })
      await check('list keyset pages are bounded, stable and owner-isolated', async () => {
        const firstPage = requireResult(await owner.rpc('list_owned_lists',
          listPageArgs('archived', null, 'name_asc', 101)), 'First archived list page')
        requireCondition(firstPage.length === 101 && firstPage.every((row) => row.owner_id === ids.owner
          && row.archived_at !== null), 'Archived page was unbounded or crossed collection/owner')
        const firstVisible = firstPage.slice(0, 100)
        const cursor = firstVisible.at(-1)
        const nextPage = requireResult(await owner.rpc('list_owned_lists',
          listPageArgs('archived', null, 'name_asc', 100, cursor)), 'Next archived list page')
        requireCondition(nextPage.length === 100
          && firstVisible.every((row) => !nextPage.some((next) => next.id === row.id)),
        'Keyset pages overlapped or were incomplete')
        const workloadPage = requireResult(await owner.rpc('list_owned_lists',
          listPageArgs('archived', 'BIOLO', 'name_asc', 10)), 'Search workload page')
        const otherOwner = requireResult(await other.rpc('list_owned_lists',
          listPageArgs('active', 'BIOLO', 'name_asc', 10)), 'Other owner search')
        requireCondition(workloadPage.length === 1 && otherOwner.length === 0,
          'Search returned an incorrect match or another owner’s list')
        const anonymousQuery = await anonymous.rpc('list_owned_lists', listPageArgs('active', null, 'name_asc', 10))
        requireCondition(Boolean(anonymousQuery.error), 'Anonymous caller queried private list collection')
        const limited = await owner.rpc('list_owned_lists', listPageArgs('archived', null, 'name_asc', 102))
        requireCondition(limited.error?.code === '22023', 'Oversized page request was not rejected')
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
        requireCondition(practice.rating === 4 && concept.description === 'Synthetic source description', 'Note update changed unrelated data')
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
      await check('archived lists remain readable while every associated write is rejected', async () => {
        const protectedConcept = requireResult(await owner.rpc('create_concept', {
          p_list_id: ids.list, p_title: 'Archived protected concept', p_description: 'Keep this content unchanged',
        }), 'Protected archived-list concept fixture')
        ids.archivedGuardConcept = protectedConcept.id
        const archived = requireResult(await owner.rpc('archive_private_list', { p_list_id: ids.list }), 'Archive read-only boundary fixture')
        requireCondition(archived.archived_at !== null, 'Read-only boundary fixture was not archived')

        const [ownerList, ownerConcepts, ownerHistory, ownerRoundHistory, ownerPractice] = await Promise.all([
          owner.from('lists').select('id,archived_at').eq('id', ids.list),
          owner.from('concepts').select('id,title,description,state,position,deleted_at').eq('list_id', ids.list),
          owner.rpc('list_practice_history', { p_list_id: ids.list, p_kind: 'associated', p_page_size: 50 }),
          owner.rpc('list_round_appearances', { p_round_ids: [ids.round] }),
          owner.rpc('get_saved_practice', { p_id: ids.practice }),
        ])
        requireCondition(requireResult(ownerList, 'Archived owner list read').length === 1
          && requireResult(ownerConcepts, 'Archived owner concept read').some((concept) => concept.id === protectedConcept.id)
          && ownerHistory.data?.items.some((item) => item.id === ids.practice)
          && ownerRoundHistory.data?.length === 1 && ownerPractice.data?.practice?.id === ids.practice,
        'Owner could not inspect archived list content and history')

        const currentRound = requireResult(await owner.rpc('get_current_round_readonly', { p_list_id: ids.list }), 'Read-only current round')
        const missingRoundBefore = requireResult(await admin.from('rounds').select('id').eq('list_id', ids.workloadLists[1]), 'Missing-round before read')
        const missingRound = requireResult(await owner.rpc('get_current_round_readonly', { p_list_id: ids.workloadLists[1] }), 'Read-only missing current round')
        const missingRoundAfter = requireResult(await admin.from('rounds').select('id').eq('list_id', ids.workloadLists[1]), 'Missing-round after read')
        const otherRoundRead = await other.rpc('get_current_round_readonly', { p_list_id: ids.list })
        const anonymousRoundRead = await anonymous.rpc('get_current_round_readonly', { p_list_id: ids.list })
        requireCondition(currentRound.length === 1 && currentRound[0].id === ids.round
          && missingRound.length === 0 && missingRoundBefore.length === 0 && missingRoundAfter.length === 0
          && Boolean(otherRoundRead.error) && Boolean(anonymousRoundRead.error),
        'Read-only round path returned another owner, or created a missing round')

        const oldCreateRound = await owner.rpc('get_or_create_current_round', { p_list_id: ids.workloadLists[1] })
        requireCondition(oldCreateRound.error?.message?.includes('list_archived_read_only'),
          'Mutating current-round path remained callable for an archived list')

        const listPracticeIds = requireResult(await admin.from('practices').select('id').eq('list_id', ids.list), 'Archived practice IDs')
        const readSnapshot = async () => ({
          list: requireResult(await admin.from('lists').select('id,name,name_normalized,archived_at,updated_at').eq('id', ids.list).single(), 'Archived list snapshot'),
          concepts: requireResult(await admin.from('concepts').select('id,title,description,state,position,deleted_at,updated_at').eq('list_id', ids.list).order('id'), 'Archived concepts snapshot'),
          rounds: requireResult(await admin.from('rounds').select('id,list_id,status,opened_at,closed_at,anonymous_appearance_total').eq('list_id', ids.list).order('id'), 'Archived rounds snapshot'),
          appearances: requireResult(await admin.from('round_appearances').select('id,round_id,concept_id,appearance_order,origin,title_snapshot,concept_deleted').eq('round_id', ids.round).order('appearance_order'), 'Archived appearances snapshot'),
          operations: requireResult(await admin.from('round_operations').select('list_id,operation_id,round_id,action,outcome,appearance_id,concept_id,result_state').eq('list_id', ids.list), 'Archived round operations snapshot'),
          practices: requireResult(await admin.from('practices').select('id,kind,list_id,concept_id,round_id,appearance_id,title_snapshot,rating').eq('list_id', ids.list).order('id'), 'Archived practices snapshot'),
          notes: listPracticeIds.length ? requireResult(await admin.from('practice_notes').select('practice_id,body,revision').in('practice_id', listPracticeIds.map((practice) => practice.id)).order('practice_id'), 'Archived notes snapshot') : [],
          noteOperations: listPracticeIds.length ? requireResult(await admin.from('practice_note_operations').select('practice_id,operation_id,operation_kind,expected_revision,resulting_revision,outcome').in('practice_id', listPracticeIds.map((practice) => practice.id)).order('practice_id,operation_id'), 'Archived note operations snapshot') : [],
        })
        const before = await readSnapshot()
        const conceptVersion = before.concepts.find((concept) => concept.id === protectedConcept.id)
        const writeResults = await Promise.all([
          owner.rpc('rename_private_list', { p_list_id: ids.list, p_name: 'Archived rename attempt' }),
          owner.rpc('create_concept', { p_list_id: ids.list, p_title: 'Archived create attempt', p_description: '' }),
          owner.rpc('create_concepts_batch', { p_list_id: ids.list, p_items: [{ title: 'Archived batch attempt', description: '' }] }),
          owner.rpc('update_concept', {
            p_concept_id: protectedConcept.id, p_title: 'Changed archived concept',
            p_description: 'Changed description', p_expected_updated_at: conceptVersion.updated_at,
          }),
          owner.rpc('delete_concept', { p_concept_id: protectedConcept.id, p_expected_updated_at: conceptVersion.updated_at }),
          owner.rpc('mark_concept_seen', { p_list_id: ids.list, p_concept_id: protectedConcept.id, p_operation_id: randomUUID() }),
          owner.rpc('draw_pending_concept', { p_list_id: ids.list, p_operation_id: randomUUID() }),
          owner.rpc('return_concept_to_pending', { p_list_id: ids.list, p_concept_id: protectedConcept.id, p_operation_id: randomUUID() }),
          owner.rpc('start_new_round', { p_list_id: ids.list, p_operation_id: randomUUID() }),
          owner.rpc('save_completed_practice', {
            p_id: randomUUID(), p_kind: 'associated', p_list_id: ids.list,
            p_concept_id: protectedConcept.id, p_round_id: ids.round,
            p_appearance_id: null, p_duration_minutes: 5,
            p_completed_at: '2026-01-05T16:00:00Z', p_label: null, p_note: 'Blocked archived practice', p_rating: null,
          }),
          owner.rpc('update_practice_note', {
            p_practice_id: ids.practice, p_operation_id: randomUUID(),
            p_expected_revision: 1, p_body: 'Blocked archived note edit',
          }),
          owner.rpc('delete_practice_note', {
            p_practice_id: ids.practice, p_operation_id: randomUUID(), p_expected_revision: 1,
          }),
        ])
        requireCondition(writeResults.every((result) => result.error?.message?.includes('list_archived_read_only')),
          'One or more trusted list-linked writes were not rejected for the archived parent')
        const [crossOwnerWrite, anonymousWrite, independentPractice] = await Promise.all([
          other.rpc('create_concept', { p_list_id: ids.list, p_title: 'Cross-owner attempt', p_description: '' }),
          anonymous.rpc('draw_pending_concept', { p_list_id: ids.list, p_operation_id: randomUUID() }),
          owner.rpc('save_completed_practice', {
            p_id: randomUUID(), p_kind: 'independent', p_list_id: null,
            p_concept_id: null, p_round_id: null, p_appearance_id: null,
            p_duration_minutes: 3, p_completed_at: '2026-01-05T16:05:00Z',
            p_label: 'Independent while archived', p_note: null, p_rating: null,
          }),
        ])
        requireCondition(Boolean(crossOwnerWrite.error) && Boolean(anonymousWrite.error)
          && !independentPractice.error && independentPractice.data?.practice?.kind === 'independent',
        'Archived boundary exposed another owner or blocked independent practice')
        const after = await readSnapshot()
        requireCondition(JSON.stringify(after) === JSON.stringify(before),
          'A rejected archived-list operation changed list, concept, round, practice, note, or history data')
      })
      await check('list deletion removes authored practice data and preserves anonymous totals', async () => {
        const anonymousRoundId = ids.round
        const before = requireResult(await owner.from('lists').select('id').eq('id', ids.list), 'Delete confirmation target read')
        requireCondition(before.length === 1, 'Synthetic list disappeared before the confirmed delete call')
        const [crossOwner, anonymousResult, directWrite] = await Promise.all([
          other.rpc('delete_private_list', { p_list_id: ids.list }),
          anonymous.rpc('delete_private_list', { p_list_id: ids.list }),
          owner.from('lists').delete().eq('id', ids.list),
        ])
        requireCondition(Boolean(crossOwner.error) && Boolean(anonymousResult.error)
          && directWrite.error?.code === '42501', 'Unauthorized or direct list deletion unexpectedly succeeded')
        const unchanged = requireResult(await owner.from('lists').select('id').eq('id', ids.list), 'Rejected delete readback')
        const practiceBefore = requireResult(await owner.from('practices').select('id').eq('id', ids.practice), 'Rejected delete practice readback')
        requireCondition(unchanged.length === 1 && practiceBefore.length === 1, 'Rejected deletion changed list or practice data')

        const deleted = requireResult(await owner.rpc('delete_private_list', { p_list_id: ids.list }), 'Confirmed list deletion')
        requireCondition(deleted === ids.list, 'Delete RPC did not confirm the requested list identity')
        const [lists, concepts, practices, notes, receipts, totals, visibleTotals, appearances, roundOperations, duplicateCopy] = await Promise.all([
          admin.from('lists').select('id').eq('id', ids.list),
          admin.from('concepts').select('id').eq('list_id', ids.list),
          admin.from('practices').select('id').eq('id', ids.practice),
          admin.from('practice_notes').select('practice_id').eq('practice_id', ids.practice),
          admin.from('practice_note_operations').select('practice_id').eq('practice_id', ids.practice),
          admin.from('rounds').select('id,list_id,status,created_at,opened_at,closed_at,anonymous_appearance_total')
            .in('id', [anonymousRoundId, ids.tiedRound]).order('id'),
          owner.from('rounds').select('id').eq('id', anonymousRoundId),
          admin.from('round_appearances').select('id').in('round_id', [anonymousRoundId, ids.tiedRound]),
          admin.from('round_operations').select('operation_id').eq('list_id', ids.list),
          admin.from('lists').select('id').eq('id', ids.duplicateListId),
        ])
        requireCondition(requireResult(lists, 'Deleted list check').length === 0
          && requireResult(concepts, 'Deleted concepts check').length === 0
          && requireResult(practices, 'Deleted practice check').length === 0
          && requireResult(notes, 'Deleted note check').length === 0
          && requireResult(receipts, 'Deleted receipt check').length === 0
          && requireResult(appearances, 'Deleted appearances check').length === 0
          && requireResult(roundOperations, 'Deleted round operation check').length === 0,
        'List deletion retained authored content, practice data, or history details')
        const remainingTotal = requireResult(totals, 'Anonymous total check')
        const allowedRoundFields = ['anonymous_appearance_total', 'closed_at', 'created_at', 'id', 'list_id', 'opened_at', 'status']
        requireCondition(remainingTotal.length === 2
          && remainingTotal.every((round) => round.list_id === null && round.status === 'closed'
            && round.created_at === null && round.opened_at === null && round.closed_at === null
            && Object.keys(round).sort().join(',') === allowedRoundFields.join(','))
          && remainingTotal.find((round) => round.id === anonymousRoundId)?.anonymous_appearance_total === 2
          && remainingTotal.find((round) => round.id === ids.tiedRound)?.anonymous_appearance_total === 0
          && requireResult(visibleTotals, 'Anonymous visibility check').length === 0
          && requireResult(duplicateCopy, 'Unrelated duplicate retention check').length === 1,
        'Deletion failed to retain only field-limited round totals or changed unrelated copy data')
      })
      await check('account deletion marker is caller-bound, idempotent and removes linked rounds only', async () => {
        const linkedRoundId = randomUUID()
        const linkedAppearanceId = randomUUID()
        trackRound(linkedRoundId)
        trackAppearance(linkedAppearanceId)
        requireResult(await admin.from('rounds').insert({
          id: linkedRoundId, list_id: ids.collectionLists.biologyOne, status: 'open',
          opened_at: '2026-01-06T12:00:00Z', created_at: '2026-01-06T12:00:00Z',
        }), 'Linked round lifecycle fixture')
        requireResult(await admin.from('round_appearances').insert({
          id: linkedAppearanceId, round_id: linkedRoundId, concept_id: null,
          appearance_order: 1, origin: 'manual', title_snapshot: 'Lifecycle fixture', concept_deleted: false,
        }), 'Linked appearance lifecycle fixture')
        const linkedBefore = requireResult(await admin.from('rounds').select('id,list_id')
          .eq('id', linkedRoundId).single(), 'Linked round before deletion request')
        requireCondition(linkedBefore.list_id === ids.collectionLists.biologyOne,
          'Synthetic account round was not linked to the caller-owned list')
        const detachedBefore = requireResult(await admin.from('rounds').select('id,list_id,anonymous_appearance_total')
          .eq('id', ids.round).single(), 'Previously anonymized round before deletion request')
        requireCondition(detachedBefore.list_id === null && detachedBefore.anonymous_appearance_total === 2,
          'Expected an already-detached anonymous total from the earlier list-deletion check')

        const [initialOwner, initialOther] = await Promise.all([
          owner.rpc('get_account_deletion_status'), other.rpc('get_account_deletion_status'),
        ])
        requireCondition(requireResult(initialOwner, 'Owner initial deletion status') === 'active'
          && requireResult(initialOther, 'Other initial deletion status') === 'active',
        'A new account did not begin in active lifecycle state')
        requireCondition(requireResult(await owner.rpc('ensure_profile'), 'Active profile initialization').id === ids.owner,
          'Active account could not initialize its profile')
        ids.readBoundaryConcept = randomUUID()
        requireResult(await admin.from('concepts').insert({
          id: ids.readBoundaryConcept, list_id: ids.collectionLists.biologyOne,
          title: 'Pending boundary fixture', description: 'Synthetic private read fixture', position: 9001,
        }), 'Private read boundary concept fixture')
        ids.readBoundaryRound = randomUUID()
        ids.readBoundaryAppearance = randomUUID()
        ids.readBoundaryPractice = randomUUID()
        ids.readBoundaryNoteOperation = randomUUID()
        trackRound(ids.readBoundaryRound)
        trackAppearance(ids.readBoundaryAppearance)
        requireResult(await admin.from('rounds').insert({ id: ids.readBoundaryRound,
          list_id: ids.workloadLists[1], status: 'open',
          opened_at: '2026-01-07T12:00:00Z', created_at: '2026-01-07T12:00:00Z' }), 'Private read boundary round fixture')
        requireResult(await admin.from('round_appearances').insert({ id: ids.readBoundaryAppearance,
          round_id: ids.readBoundaryRound, concept_id: ids.readBoundaryConcept,
          appearance_order: 1, origin: 'draw', title_snapshot: 'Pending boundary fixture', concept_deleted: false }),
        'Private read boundary appearance fixture')
        requireResult(await owner.rpc('save_completed_practice', {
          p_id: ids.readBoundaryPractice, p_kind: 'independent', p_list_id: null,
          p_concept_id: null, p_round_id: null, p_appearance_id: null, p_duration_minutes: 12,
          p_completed_at: '2026-01-07T12:10:00Z', p_label: 'Synthetic private history',
          p_note: 'Synthetic private note', p_rating: null,
        }), 'Private read boundary practice fixture')
        requireResult(await admin.from('practice_note_operations').insert({ owner_id: ids.owner,
          practice_id: ids.readBoundaryPractice, operation_id: ids.readBoundaryNoteOperation,
          operation_kind: 'update', expected_revision: 1, resulting_revision: 2, outcome: 'updated' }),
        'Private read boundary note receipt fixture')
        const activeReads = await Promise.all([
          owner.from('profiles').select('id').eq('id', ids.owner),
          owner.from('lists').select('id').eq('id', ids.collectionLists.biologyOne),
          owner.from('concepts').select('id').eq('id', ids.readBoundaryConcept),
          owner.from('rounds').select('id').eq('id', ids.readBoundaryRound),
          owner.from('round_appearances').select('id').eq('id', ids.readBoundaryAppearance),
          owner.from('practices').select('id').eq('id', ids.readBoundaryPractice),
          owner.from('practice_notes').select('practice_id').eq('practice_id', ids.readBoundaryPractice),
          owner.from('practice_note_operations').select('practice_id').eq('practice_id', ids.readBoundaryPractice),
          owner.rpc('list_owned_lists', { p_collection: 'active' }),
          owner.rpc('get_current_round_readonly', { p_list_id: ids.workloadLists[1] }),
          owner.rpc('get_saved_practice', { p_id: ids.readBoundaryPractice }),
          owner.rpc('list_practice_history'),
          owner.rpc('list_round_history'),
          owner.rpc('list_round_appearances', { p_round_ids: [ids.readBoundaryRound] }),
        ])
        requireCondition(requireResult(activeReads[0], 'Active profile read').length === 1,
          'Active profile RLS read did not return the owner row')
        requireCondition(requireResult(activeReads[1], 'Active list read').length === 1,
          'Active list RLS read did not return the owner row')
        requireCondition(requireResult(activeReads[2], 'Active concept read').length === 1,
          'Active concept RLS read did not return concepts')
        requireCondition(requireResult(activeReads[3], 'Active round read').length === 1
          && requireResult(activeReads[4], 'Active appearance read').length === 1
          && requireResult(activeReads[5], 'Active practice read').length === 1
          && requireResult(activeReads[6], 'Active note read').length === 1
          && requireResult(activeReads[7], 'Active note receipt read').length === 1,
        'Active owner lost an existing round, practice, or note read')
        requireCondition(requireResult(activeReads[8], 'Active list query').length > 0,
          'Active list query returned no lists')
        requireCondition(requireResult(activeReads[9], 'Active current round query').length === 1
          && requireResult(activeReads[10], 'Active saved practice query').practice.id === ids.readBoundaryPractice
          && requireResult(activeReads[11], 'Active practice history query').items.some((item) => item.id === ids.readBoundaryPractice)
          && requireResult(activeReads[12], 'Active round history query').items.some((item) => item.id === ids.readBoundaryRound)
          && requireResult(activeReads[13], 'Active round appearance query').length === 1,
        'Active owner lost an existing definer-backed read contract')
        const activeGetOrCreateRound = requireResult(await owner.rpc('get_or_create_current_round', {
          p_list_id: ids.collectionLists.biologyOne,
        }), 'Active get-or-create round read')
        requireCondition(activeGetOrCreateRound.id === linkedRoundId,
          'Active get-or-create round no longer returns the existing round')
        const [anonymousStatus, spoofedBegin] = await Promise.all([
          anonymous.rpc('get_account_deletion_status'),
          other.rpc('begin_account_deletion', { p_user_id: ids.owner }),
        ])
        requireCondition(Boolean(anonymousStatus.error) && Boolean(spoofedBegin.error),
          'Anonymous status or caller-supplied target identity was accepted')
        requireResult(await owner.rpc('begin_account_deletion'), 'Begin deletion for synthetic owner')
        const firstMarker = requireResult(await admin.from('account_deletion_requests')
          .select('user_id,state,requested_at,completed_at').eq('user_id', ids.owner), 'Initial restricted deletion marker')
        requireCondition(requireResult(await owner.rpc('get_account_deletion_status'), 'Pending deletion status') === 'deletion_pending'
          && requireResult(await owner.rpc('begin_account_deletion'), 'Idempotent deletion retry') === 'deletion_pending'
          && requireResult(await owner.rpc('get_account_deletion_status'), 'Repeated pending deletion status') === 'deletion_pending',
        'Deletion begin was not durable and idempotent')
        const pendingListCreation = await owner.rpc('create_private_list', { p_name: 'Must remain blocked' })
        requireCondition(Boolean(pendingListCreation.error),
          'Pending account created a private list')
        const retriedMarker = requireResult(await admin.from('account_deletion_requests')
          .select('user_id,state,requested_at,completed_at').eq('user_id', ids.owner), 'Retried restricted deletion marker')
        requireCondition(firstMarker.length === 1 && retriedMarker.length === 1
          && firstMarker[0].state === 'pending' && firstMarker[0].completed_at === null
          && firstMarker[0].requested_at === retriedMarker[0].requested_at
          && Object.keys(firstMarker[0]).sort().join(',') === 'completed_at,requested_at,state,user_id',
        'Deletion retries changed the marker or the marker retained unexpected fields')

        const ownerDataBeforeWrites = {
          lists: requireResult(await admin.from('lists').select('id').eq('owner_id', ids.owner).order('id'), 'Pending write list baseline'),
          concepts: requireResult(await admin.from('concepts').select('id,title,description,updated_at')
            .eq('list_id', ids.collectionLists.biologyOne).order('id'), 'Pending write concept baseline'),
          practices: requireResult(await admin.from('practices').select('id').eq('owner_id', ids.owner).order('id'), 'Pending write practice baseline'),
          note: requireResult(await admin.from('practice_notes').select('body,revision')
            .eq('practice_id', ids.readBoundaryPractice).single(), 'Pending write note baseline'),
        }
        const pendingRoundId = randomUUID()
        trackRound(pendingRoundId)
        requireResult(await admin.from('rounds').insert({ id: pendingRoundId,
          list_id: ids.collectionLists.biologyOne, status: 'open',
          opened_at: '2026-01-08T12:00:00Z', created_at: '2026-01-08T12:00:00Z' }),
        'Pending mutation round fixture')
        const conceptVersion = ownerDataBeforeWrites.concepts.find((concept) => concept.id === ids.readBoundaryConcept)
        requireCondition(Boolean(conceptVersion), 'Pending mutation concept fixture was missing')
        const requirePendingMutationRejected = async (name, result) => {
          requireCondition(Boolean(result.error), `Pending account mutation was accepted: ${name}`)
        }
        await requirePendingMutationRejected('create list', await owner.rpc('create_private_list', { p_name: 'Must remain blocked' }))
        await requirePendingMutationRejected('rename list', await owner.rpc('rename_private_list', {
          p_list_id: ids.collectionLists.biologyOne, p_name: 'Must remain blocked',
        }))
        await requirePendingMutationRejected('archive list', await owner.rpc('archive_private_list', {
          p_list_id: ids.collectionLists.biologyOne,
        }))
        await requirePendingMutationRejected('restore list', await owner.rpc('restore_private_list', {
          p_list_id: ids.collectionLists.biologyOne,
        }))
        await requirePendingMutationRejected('duplicate list', await owner.rpc('duplicate_private_list', {
          p_source_list_id: ids.collectionLists.biologyOne, p_operation_id: randomUUID(), p_name: 'Must remain blocked',
        }))
        await requirePendingMutationRejected('delete list', await owner.rpc('delete_private_list', {
          p_list_id: ids.collectionLists.biologyOne,
        }))
        await requirePendingMutationRejected('create concept', await owner.rpc('create_concept', {
          p_list_id: ids.collectionLists.biologyOne, p_title: 'Must remain blocked', p_description: '',
        }))
        await requirePendingMutationRejected('batch create concepts', await owner.rpc('create_concepts_batch', {
          p_list_id: ids.collectionLists.biologyOne,
          p_items: [{ title: 'Must remain blocked', description: '' }],
        }))
        await requirePendingMutationRejected('update concept', await owner.rpc('update_concept', {
          p_concept_id: ids.readBoundaryConcept, p_title: 'Must remain blocked', p_description: '',
          p_expected_updated_at: conceptVersion.updated_at,
        }))
        await requirePendingMutationRejected('delete concept', await owner.rpc('delete_concept', {
          p_concept_id: ids.readBoundaryConcept, p_expected_updated_at: conceptVersion.updated_at,
        }))
        await requirePendingMutationRejected('round operation', await owner.rpc('perform_round_operation', {
          p_list_id: ids.collectionLists.biologyOne, p_operation_id: randomUUID(),
          p_action: 'mark_seen', p_concept_id: ids.readBoundaryConcept,
        }))
        await requirePendingMutationRejected('save independent practice', await owner.rpc('save_completed_practice', {
          p_id: randomUUID(), p_kind: 'independent', p_list_id: null, p_concept_id: null,
          p_round_id: null, p_appearance_id: null, p_duration_minutes: 5,
          p_completed_at: '2026-01-08T12:05:00Z', p_label: 'Must remain blocked', p_note: null, p_rating: null,
        }))
        await requirePendingMutationRejected('update note', await owner.rpc('update_practice_note', {
          p_practice_id: ids.readBoundaryPractice, p_operation_id: randomUUID(),
          p_expected_revision: 1, p_body: 'Must remain blocked',
        }))
        await requirePendingMutationRejected('delete note', await owner.rpc('delete_practice_note', {
          p_practice_id: ids.readBoundaryPractice, p_operation_id: randomUUID(), p_expected_revision: 1,
        }))
        const directPreferenceWrite = await owner.from('profiles').update({ locale: 'es' })
          .eq('id', ids.owner).select('id')
        requireCondition(!directPreferenceWrite.error && directPreferenceWrite.data.length === 0,
          'Pending account changed profile preferences directly')
        await requirePendingMutationRejected('ensure_profile', await owner.rpc('ensure_profile'))
        const ownerDataAfterWrites = {
          lists: requireResult(await admin.from('lists').select('id').eq('owner_id', ids.owner).order('id'), 'Pending write list readback'),
          concepts: requireResult(await admin.from('concepts').select('id,title,description,updated_at')
            .eq('list_id', ids.collectionLists.biologyOne).order('id'), 'Pending write concept readback'),
          practices: requireResult(await admin.from('practices').select('id').eq('owner_id', ids.owner).order('id'), 'Pending write practice readback'),
          note: requireResult(await admin.from('practice_notes').select('body,revision')
            .eq('practice_id', ids.readBoundaryPractice).single(), 'Pending write note readback'),
        }
        requireCondition(JSON.stringify(ownerDataAfterWrites) === JSON.stringify(ownerDataBeforeWrites),
          'Rejected pending mutations caused partial writes')
        requireResult(await admin.from('profiles').delete().eq('id', ids.owner), 'Remove profile for pending recreation fixture')
        await requirePendingMutationRejected('ensure_profile after profile removal', await owner.rpc('ensure_profile'))
        requireCondition(requireResult(await admin.from('profiles').select('id').eq('id', ids.owner),
          'Pending profile recreation readback').length === 0,
        'ensure_profile recreated the pending account profile')

        const [removedRound, remainingAppearances, otherRound, otherAppearance, otherList, otherStatus,
          callerMarkerRead, otherMarkerRead, anonymousMarkerRead] = await Promise.all([
          admin.from('rounds').select('id').eq('id', linkedRoundId),
          admin.from('round_appearances').select('id').eq('round_id', linkedRoundId),
          admin.from('rounds').select('id,list_id').eq('id', ids.otherRound),
          admin.from('round_appearances').select('id').eq('round_id', ids.otherRound),
          other.from('lists').select('id').eq('id', ids.otherList),
          other.rpc('get_account_deletion_status'),
          owner.from('account_deletion_requests').select('user_id'),
          other.from('account_deletion_requests').select('user_id'),
          anonymous.from('account_deletion_requests').select('user_id'),
        ])
        const retainedAnonymous = requireResult(await admin.from('rounds').select('id,list_id,anonymous_appearance_total')
          .eq('id', ids.round).single(), 'Previously anonymized round after deletion request')
        requireCondition(requireResult(removedRound, 'Deleted linked round check').length === 0
          && requireResult(remainingAppearances, 'Deleted linked appearances check').length === 0
          && requireResult(otherRound, 'Other owner linked round check').length === 1
          && requireResult(otherRound, 'Other owner linked round readback')[0].list_id === ids.otherList
          && requireResult(otherAppearance, 'Other owner round appearance check').length === 1
          && requireResult(otherList, 'Other owner list check').length === 1
          && requireResult(otherStatus, 'Other owner lifecycle status') === 'active'
          && retainedAnonymous.list_id === null && retainedAnonymous.anonymous_appearance_total === 2,
        'Caller deletion request affected another owner or changed an already-anonymous total')
        requireCondition(Boolean(anonymousMarkerRead.error) && Boolean(callerMarkerRead.error)
          && Boolean(otherMarkerRead.error),
          'Deletion marker table was directly readable by browser roles')
        const exposedPredicate = await owner.rpc('is_active_account')
        requireCondition(Boolean(exposedPredicate.error),
          'Internal active-account predicate was exposed as a browser RPC')
        const pendingGetOrCreateRound = await owner.rpc('get_or_create_current_round', {
          p_list_id: ids.collectionLists.biologyOne,
        })
        requireCondition(pendingGetOrCreateRound.error?.message?.includes('account_deletion_pending'),
          'Pending account used the mixed read/mutation RPC')

        const [pendingProfile, pendingLists, pendingConcepts, pendingRounds, pendingAppearances,
          pendingPractices, pendingNotes, pendingReceipts, pendingListQuery, pendingCurrentRound,
          pendingSavedPractice, pendingPracticeHistory, pendingRoundHistory, pendingRoundAppearances,
          unaffectedOtherProfile, unaffectedOtherConcepts, anonymousPrivateRead] = await Promise.all([
          owner.from('profiles').select('id').eq('id', ids.owner),
          owner.from('lists').select('id').eq('id', ids.collectionLists.biologyOne),
          owner.from('concepts').select('id').eq('id', ids.readBoundaryConcept),
          owner.from('rounds').select('id').eq('list_id', ids.workloadLists[1]),
          owner.from('round_appearances').select('id').eq('round_id', ids.readBoundaryRound),
          owner.from('practices').select('id').eq('id', ids.readBoundaryPractice),
          owner.from('practice_notes').select('practice_id').eq('practice_id', ids.readBoundaryPractice),
          owner.from('practice_note_operations').select('practice_id').eq('practice_id', ids.readBoundaryPractice),
          owner.rpc('list_owned_lists', { p_collection: 'active' }),
          owner.rpc('get_current_round_readonly', { p_list_id: ids.workloadLists[1] }),
          owner.rpc('get_saved_practice', { p_id: ids.readBoundaryPractice }),
          owner.rpc('list_practice_history'),
          owner.rpc('list_round_history'),
          owner.rpc('list_round_appearances', { p_round_ids: [ids.readBoundaryRound] }),
          other.from('profiles').select('id').eq('id', ids.other),
          other.from('lists').select('id').eq('id', ids.otherList),
          anonymous.from('lists').select('id'),
        ])
        const privateRows = [pendingProfile, pendingLists, pendingConcepts, pendingRounds,
          pendingAppearances, pendingPractices, pendingNotes, pendingReceipts,
          pendingListQuery, pendingCurrentRound]
        requireCondition(privateRows.every((result) => requireResult(result, 'Pending direct read boundary').length === 0)
          && requireResult(pendingSavedPractice, 'Pending saved practice boundary') === null
          && requireResult(pendingPracticeHistory, 'Pending practice history boundary').items.length === 0
          && requireResult(pendingRoundHistory, 'Pending round history boundary').items.length === 0
          && requireResult(pendingRoundAppearances, 'Pending round appearance boundary').length === 0
          && requireResult(unaffectedOtherProfile, 'Unrelated owner profile read').length === 1
          && requireResult(unaffectedOtherConcepts, 'Unrelated owner list read').length === 1
          && Boolean(anonymousPrivateRead.error),
        'Pending account retained private read access, exposed data through a definer query, or affected another principal')
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
