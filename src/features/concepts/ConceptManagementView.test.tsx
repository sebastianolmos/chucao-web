import { MantineProvider } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveConceptRow, ListRow } from '../../lib/database.types';
import type { RoundCommandResult } from '../rounds/roundService';
import { queryClient } from '../../lib/queryClient';
import i18n from '../../i18n/i18n';
import { resources } from '../../i18n/resources';
import { ConceptManagementView } from './ConceptManagementView';
import { ListDetailView } from '../lists/ListDetailView';
import { restorePrivateList } from '../lists/listService';
import { createConcept, createConceptBatch, deleteConcept, getOwnedConcepts, updateConcept } from './conceptService';
import { DomainServiceError } from '../shared/supabaseErrors';
import { ToastProvider, ToastViewport } from '../../app/toasts/ToastProvider';
import { ToastContext } from '../../app/toasts/toastContext';
import { listPracticeHistory } from '../history/historyService';
import {
  drawPendingConcept,
  loadCurrentRound,
  markConceptSeen,
  returnConceptToPending,
  retryUnresolvedRoundOperation,
  startNewRound,
} from '../rounds/roundService';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

vi.mock('./conceptService', () => ({
  conceptQueryKey: (userId: string, listId: string) => ['concepts', userId, listId],
  getOwnedConcepts: vi.fn(),
  createConcept: vi.fn(),
  createConceptBatch: vi.fn(),
  updateConcept: vi.fn(),
  deleteConcept: vi.fn(),
}));

vi.mock('../lists/listService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lists/listService')>(),
  restorePrivateList: vi.fn(),
}));

vi.mock('../rounds/roundService', () => ({
  roundQueryKey: (userId: string, listId: string) => ['round', userId, listId],
  loadCurrentRound: vi.fn(),
  drawPendingConcept: vi.fn(),
  markConceptSeen: vi.fn(),
  returnConceptToPending: vi.fn(),
  retryUnresolvedRoundOperation: vi.fn(),
  startNewRound: vi.fn(),
}));

vi.mock('../history/historyService', () => ({ listPracticeHistory: vi.fn() }));

const list = { id: 'list-a', name: 'Anatomía', owner_id: 'user-a' } as ListRow;
const existingConcept: ActiveConceptRow = {
  id: 'concept-1', list_id: list.id, title: 'Anatomía', description: 'Estudio del cuerpo',
  state: 'pending', position: 0, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', deleted_at: null,
};
let currentConcepts: ActiveConceptRow[] = [];
const currentRound = {
  id: 'round-a', list_id: list.id, status: 'open' as const,
  opened_at: '2026-01-01T00:00:00Z', closed_at: null,
  anonymous_appearance_total: null, created_at: '2026-01-01T00:00:00Z',
};

function renderView(
  onStartPractice = vi.fn(),
  pendingRoundAction?: { id: number; listId: string; action: 'draw' | 'new_round' } | null,
  onRoundActionRequestHandled = vi.fn(),
) {
  queryClient.clear();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <ToastProvider>
          <ConceptManagementView
            userId="user-a"
            list={list}
            onBack={vi.fn()}
            onStartPractice={onStartPractice}
            pendingRoundAction={pendingRoundAction}
            onRoundActionRequestHandled={onRoundActionRequestHandled}
          />
          <ToastViewport />
        </ToastProvider>
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('ConceptManagementView', () => {
  beforeEach(async () => {
    await act(async () => { await i18n.changeLanguage('es'); });
    queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
    vi.mocked(getOwnedConcepts).mockResolvedValue([]);
    vi.mocked(listPracticeHistory).mockResolvedValue({ items: [], hasMore: false, nextCursor: null, queryKey: ['practice-history', 'user-a'] });
    currentConcepts = [];
    vi.mocked(getOwnedConcepts).mockImplementation(async () => currentConcepts);
    vi.mocked(createConcept).mockResolvedValue({ status: 'created', concept: existingConcept });
    vi.mocked(createConceptBatch).mockResolvedValue({ status: 'created', concepts: [existingConcept], review: {
      status: 'ready', rawInput: '- Biología', accepted: [{ sourceIndex: 0, title: 'Biología', description: '' }], omitted: [], limitViolations: [],
    } });
    vi.mocked(updateConcept).mockResolvedValue({ status: 'updated', concept: existingConcept });
    vi.mocked(deleteConcept).mockResolvedValue({ status: 'deleted', concept: null });
    vi.mocked(loadCurrentRound).mockResolvedValue(currentRound);
    vi.mocked(drawPendingConcept).mockResolvedValue({
      status: 'confirmed', result: {
        action: 'draw', outcome: 'applied', round_id: currentRound.id,
        appearance_id: 'appearance-draw', appearance_order: 3,
        concept_id: existingConcept.id, title: existingConcept.title,
        result_state: 'seen', pending_count: 0, seen_count: 1,
      },
    });
    vi.mocked(startNewRound).mockResolvedValue({
      status: 'confirmed', result: {
        action: 'new_round', outcome: 'applied', round_id: 'round-next',
        appearance_id: null, appearance_order: null, concept_id: null,
        title: null, result_state: null, pending_count: 1, seen_count: 0,
      },
    });
    vi.mocked(markConceptSeen).mockResolvedValue({
      status: 'confirmed', result: {
        action: 'mark_seen', outcome: 'applied', round_id: currentRound.id,
        appearance_id: 'appearance-a', appearance_order: 1,
        concept_id: existingConcept.id, title: existingConcept.title,
        result_state: 'seen', pending_count: 0, seen_count: 1,
      },
    });
    vi.mocked(returnConceptToPending).mockResolvedValue({
      status: 'confirmed', result: {
        action: 'return_pending', outcome: 'applied', round_id: currentRound.id,
        appearance_id: null, appearance_order: null,
        concept_id: existingConcept.id, title: existingConcept.title,
        result_state: 'pending', pending_count: 1, seen_count: 0,
      },
    });
    vi.mocked(retryUnresolvedRoundOperation).mockResolvedValue({
      status: 'confirmed', result: {
        action: 'mark_seen', outcome: 'applied', round_id: currentRound.id,
        appearance_id: 'appearance-a', appearance_order: 1,
        concept_id: existingConcept.id, title: existingConcept.title,
        result_state: 'seen', pending_count: 0, seen_count: 1,
      },
    });
  });

  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage('es'); });
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('offers deleted-concept notes from the list context', async () => {
    renderView();
    expect(await screen.findByRole('button', { name: i18n.t('practiceNote.deletedConceptsShort') })).toBeInTheDocument();
    expect(listPracticeHistory).not.toHaveBeenCalled();
  });

  it('keeps archived concepts and notes readable while hiding every mutating or study action', async () => {
    currentConcepts = [existingConcept];
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><MantineProvider env="test"><ToastProvider>
      <ConceptManagementView userId="user-a" list={{ ...list, archived_at: '2026-01-01T00:00:00Z' }} onBack={vi.fn()} onStartPractice={vi.fn()} archived />
      <ToastViewport />
    </ToastProvider></MantineProvider></QueryClientProvider>);
    expect((await screen.findAllByText(existingConcept.title)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: i18n.t('rounds.title') })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: existingConcept.title }) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('concepts.addTitle') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('rounds.drawConcept') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('rounds.newRound') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('rounds.markSeen') })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: existingConcept.title }) }));
    expect(await screen.findByText(existingConcept.description)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('conceptDetail.editConcept') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('conceptDetail.deleteConcept') })).not.toBeInTheDocument();
  });

  it('restores an archived list in place and retains read-only mode when the active limit rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(restorePrivateList).mockRejectedValueOnce(new DomainServiceError('list_limit', 'list_limit'))
      .mockResolvedValueOnce({ ...list, archived_at: null });
    render(<QueryClientProvider client={queryClient}><MantineProvider env="test"><ToastProvider>
      <ListDetailView userId="user-a" list={{ ...list, archived_at: '2026-01-01T00:00:00Z' }} onBack={vi.fn()} onStartPractice={vi.fn()} />
    </ToastProvider></MantineProvider></QueryClientProvider>);
    await screen.findByText(i18n.t('lists.archivedStatus'));
    await user.click(screen.getByRole('button', { name: i18n.t('lists.restore') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('lists.freeSlot'));
    expect(screen.queryByRole('button', { name: i18n.t('concepts.addTitle') })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: i18n.t('rounds.title') })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('lists.restore') }));
    await waitFor(() => expect(restorePrivateList).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(i18n.t('lists.archivedStatus'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('concepts.addTitle') })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: i18n.t('rounds.title') })).toBeInTheDocument();
  });

  it('filters concepts by study state, selects only visible rows, and announces selection clearing', async () => {
    const pending = { ...existingConcept, id: 'pending-1', title: 'Pendiente', state: 'pending' as const };
    const practiced = { ...existingConcept, id: 'seen-1', title: 'Practicado', state: 'seen' as const };
    currentConcepts = [pending, practiced];
    const user = userEvent.setup();
    renderView();
    const region = await screen.findByRole('region', { name: i18n.t('concepts.list') });
    expect(await within(region).findByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: 'Pendiente' }) })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: 'Practicado' }) })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Pendiente' }) }));
    await user.click(screen.getByRole('button', { name: i18n.t('concepts.filterPracticed') }));
    expect(await screen.findByText(i18n.t('concepts.selectionCleared'))).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: 'Pendiente' }) })).not.toBeInTheDocument();
    expect(within(region).getByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: 'Practicado' }) })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { checked: true })).not.toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(screen.getByRole('button', { name: 'Practiced' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(region).getByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: 'Practicado' }) })).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage('es'); });
  });

  it('distinguishes an empty list, an empty filter, and an exhausted round', async () => {
    renderView();
    expect(await screen.findByText(i18n.t('concepts.empty'))).toBeInTheDocument();
    currentConcepts = [{ ...existingConcept, state: 'seen' }];
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['concepts', 'user-a', list.id] }); });
    await screen.findByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: existingConcept.title }) });
    expect(await screen.findByText(i18n.t('rounds.exhausted'))).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: i18n.t('concepts.filterPending') }));
    expect(await screen.findByText(i18n.t('concepts.filterEmpty', { filter: i18n.t('concepts.filterPending') }))).toBeInTheDocument();
  });

  it('returns a selected practiced concept to pending without delete confirmation', async () => {
    currentConcepts = [{ ...existingConcept, state: 'seen' }];
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: existingConcept.title }) }));
    await user.click(screen.getByRole('button', { name: i18n.t('concepts.bulkReturnPending') }));
    await waitFor(() => expect(returnConceptToPending).toHaveBeenCalledWith(list.id, existingConcept.id));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('places concept selection after the row state action', async () => {
    currentConcepts = [existingConcept];
    renderView();
    const selection = await screen.findByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: existingConcept.title }) });
    const row = selection.closest('li');
    expect(row).not.toBeNull();
    const stateAction = within(row as HTMLElement).getByRole('button', { name: i18n.t('rounds.markSeenForConcept', { title: existingConcept.title }) });
    expect(stateAction.compareDocumentPosition(selection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stops later round items while an unresolved item still needs reconciliation', async () => {
    const first = { ...existingConcept, id: 'pending-1', title: 'Uno', state: 'pending' as const };
    const second = { ...existingConcept, id: 'pending-2', title: 'Dos', state: 'pending' as const };
    currentConcepts = [first, second];
    vi.mocked(markConceptSeen).mockResolvedValue({ status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved') });
    vi.mocked(retryUnresolvedRoundOperation).mockResolvedValue({ status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved') });
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Uno' }) }));
    await user.click(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Dos' }) }));
    await user.click(screen.getByRole('button', { name: i18n.t('concepts.bulkMarkSeen') }));
    await waitFor(() => expect(retryUnresolvedRoundOperation).toHaveBeenCalledWith(list.id));
    expect(markConceptSeen).toHaveBeenCalledTimes(1);
    expect(markConceptSeen).not.toHaveBeenCalledWith(list.id, second.id);
    expect(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Uno' }) })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Dos' }) })).toBeChecked();
  });

  it('reports partial round-action outcomes and retries only the failed concept after refreshing owner state', async () => {
    const first = { ...existingConcept, id: 'pending-1', title: 'Uno', state: 'pending' as const };
    const second = { ...existingConcept, id: 'pending-2', title: 'Dos', state: 'pending' as const };
    currentConcepts = [first, second];
    vi.mocked(markConceptSeen).mockImplementation(async (_listId, conceptId) => {
      if (conceptId === first.id && currentConcepts.some((item) => item.id === first.id && item.state === 'pending')) {
        currentConcepts = currentConcepts.map((item) => item.id === first.id ? { ...item, state: 'seen' } : item);
        return { status: 'confirmed', result: { action: 'mark_seen', outcome: 'applied', round_id: currentRound.id, appearance_id: 'appearance-1', appearance_order: 1, concept_id: first.id, title: first.title, result_state: 'seen', pending_count: 1, seen_count: 1 } };
      }
      if (conceptId === second.id && vi.mocked(markConceptSeen).mock.calls.filter((call) => call[1] === second.id).length === 1) {
        return { status: 'rejected', error: new DomainServiceError('round_action_rejected', 'round_action_rejected') };
      }
      currentConcepts = currentConcepts.map((item) => item.id === second.id ? { ...item, state: 'seen' } : item);
      return { status: 'confirmed', result: { action: 'mark_seen', outcome: 'applied', round_id: currentRound.id, appearance_id: 'appearance-2', appearance_order: 2, concept_id: second.id, title: second.title, result_state: 'seen', pending_count: 0, seen_count: 2 } };
    });
    const user = userEvent.setup();
    queryClient.clear();
    const notify = vi.fn();
    render(<QueryClientProvider client={queryClient}><MantineProvider env="test">
      <ToastContext.Provider value={{ notify, dismiss: vi.fn(), toasts: [] }}>
        <ConceptManagementView userId="user-a" list={list} onBack={vi.fn()} onStartPractice={vi.fn()} />
      </ToastContext.Provider>
    </MantineProvider></QueryClientProvider>);
    await screen.findByText('Uno');
    await user.click(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Uno' }) }));
    await user.click(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Dos' }) }));
    await user.click(screen.getByRole('button', { name: i18n.t('concepts.bulkMarkSeen') }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
    expect(notify).toHaveBeenNthCalledWith(1, `Uno: ${i18n.t('concepts.bulkOutcomeCompleted')}`, 'success', 10_000);
    expect(notify).toHaveBeenNthCalledWith(2, `Dos: ${i18n.t('concepts.bulkOutcomeFailed')}`, 'error', 10_000);
    expect(screen.queryByText(i18n.t('concepts.bulkPartial', { succeeded: 1, failed: 1 }))).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Uno' }) })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: 'Dos' }) })).toBeChecked();
    await user.click(screen.getByRole('button', { name: i18n.t('concepts.bulkMarkSeen') }));
    await waitFor(() => expect(vi.mocked(markConceptSeen).mock.calls.filter((call) => call[1] === second.id)).toHaveLength(2));
    expect(vi.mocked(markConceptSeen).mock.calls.filter((call) => call[1] === first.id)).toHaveLength(1);
    expect(screen.queryByRole('checkbox', { checked: true })).not.toBeInTheDocument();
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(3));
    expect(notify).toHaveBeenLastCalledWith(`Dos: ${i18n.t('concepts.bulkOutcomeCompleted')}`, 'success', 10_000);
  });

  it('requires confirmation for selected concept deletion and submits only after confirmation', async () => {
    currentConcepts = [existingConcept];
    const user = userEvent.setup();
    renderView();
    await screen.findByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: existingConcept.title }) });
    await user.click(screen.getByRole('checkbox', { name: i18n.t('concepts.selectConcept', { title: existingConcept.title }) }));
    await user.click(screen.getByRole('button', { name: i18n.t('concepts.bulkDelete') }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(deleteConcept).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: i18n.t('concepts.confirmBulkDelete') }));
    await waitFor(() => expect(deleteConcept).toHaveBeenCalledWith(expect.objectContaining({ conceptId: existingConcept.id, listId: list.id })));
  });

  it('opens deleted-concept notes from the symmetric list header action and returns to the list', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: i18n.t('practiceNote.deletedConceptsShort') }));
    expect(await screen.findByRole('heading', { name: i18n.t('practiceNote.deletedConceptsTitle') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('practiceNote.deletedConceptsDescription'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('practiceNote.backToList') }));
    expect(await screen.findByRole('button', { name: i18n.t('practiceNote.deletedConceptsShort') })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: i18n.t('concepts.list') })).toBeInTheDocument();
  });

  it('places the practice notes panel in the selected concept detail', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    renderView();
    await user.click(await screen.findByRole('button', { name: i18n.t('conceptDetail.viewConcept', { title: existingConcept.title }) }));
    expect(await screen.findByRole('heading', { name: i18n.t('practiceNote.listTitle') })).toBeInTheDocument();
    expect(listPracticeHistory).toHaveBeenCalledWith(expect.objectContaining({ conceptId: existingConcept.id, listId: list.id }));
  });

  it('shows the selected title and order only after a confirmed draw, without its description', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    let finishDraw!: (result: Awaited<ReturnType<typeof drawPendingConcept>>) => void;
    vi.mocked(drawPendingConcept).mockImplementationOnce(() => new Promise((resolve) => {
      finishDraw = resolve;
    }));
    renderView();

    const drawButton = await screen.findByRole('button', { name: 'Sortear concepto' });
    await user.dblClick(drawButton);

    expect(drawPendingConcept).toHaveBeenCalledOnce();
    finishDraw({
      status: 'confirmed', result: {
        action: 'draw', outcome: 'applied', round_id: currentRound.id,
        appearance_id: 'appearance-draw', appearance_order: 3,
        concept_id: existingConcept.id, title: existingConcept.title,
        result_state: 'seen', pending_count: 0, seen_count: 1,
      },
    });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Anatomía');
    expect(dialog).toHaveTextContent('Aparición 3 de la ronda');
    expect(dialog).not.toHaveTextContent('Estudio del cuerpo');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const returnButton = screen.getByRole('button', { name: 'Volver a la lista' });
    expect(returnButton).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practicar' })).toBeInTheDocument();
    await user.tab();
    expect(returnButton).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not show a result for an exhausted draw or a rejected draw', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(drawPendingConcept).mockResolvedValueOnce({
      status: 'confirmed', result: {
        action: 'draw', outcome: 'exhausted', round_id: currentRound.id,
        appearance_id: null, appearance_order: null, concept_id: null,
        title: null, result_state: null, pending_count: 0, seen_count: 1,
      },
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Sortear concepto' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('Todos los conceptos activos están vistos.');

    vi.mocked(drawPendingConcept).mockResolvedValueOnce({
      status: 'rejected', error: new DomainServiceError('unavailable', 'unavailable'),
    });
    await user.click(screen.getByRole('button', { name: 'Sortear concepto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la operación de ronda. Inténtalo de nuevo.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('recovers an unresolved draw with the same command and then shows its result', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(drawPendingConcept).mockResolvedValueOnce({
      status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved'),
    });
    vi.mocked(retryUnresolvedRoundOperation).mockResolvedValueOnce({
      status: 'confirmed', result: {
        action: 'draw', outcome: 'applied', round_id: currentRound.id,
        appearance_id: 'appearance-draw', appearance_order: 3,
        concept_id: existingConcept.id, title: existingConcept.title,
        result_state: 'seen', pending_count: 0, seen_count: 1,
      },
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Sortear concepto' }));
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Aparición 3 de la ronda');
    expect(retryUnresolvedRoundOperation).toHaveBeenCalledOnce();
  });

  it('cancels new-round confirmation without calling the service', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Iniciar nueva ronda' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('La ronda actual se cerrará y su historial se conservará. Todos los conceptos activos quedarán pendientes.');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(startNewRound).not.toHaveBeenCalled();
  });

  it('confirms one new-round command and keeps confirmation while an outcome is pending', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    let finishOperation!: (result: Awaited<ReturnType<typeof startNewRound>>) => void;
    vi.mocked(startNewRound).mockImplementationOnce(() => new Promise((resolve) => {
      finishOperation = resolve;
    }));
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Iniciar nueva ronda' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = screen.getByRole('button', { name: 'Confirmar nueva ronda' });
    await user.dblClick(confirm);
    expect(confirm).toBeDisabled();
    expect(dialog).toBeInTheDocument();
    expect(startNewRound).toHaveBeenCalledOnce();

    finishOperation({
      status: 'confirmed', result: {
        action: 'new_round', outcome: 'applied', round_id: 'round-next',
        appearance_id: null, appearance_order: null, concept_id: null,
        title: null, result_state: null, pending_count: 1, seen_count: 0,
      },
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('Nueva ronda iniciada.');
  });

  it('keeps new-round confirmation open and shows no success when rejected', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(startNewRound).mockResolvedValueOnce({
      status: 'rejected', error: new DomainServiceError('round_action_rejected', 'round_action_rejected'),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Iniciar nueva ronda' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Confirmar nueva ronda' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la acción de ronda. No se aplicaron cambios.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Nueva ronda iniciada.')).not.toBeInTheDocument();
    expect(startNewRound).toHaveBeenCalledOnce();
  });

  it('localizes draw result and restart controls in English', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Draw concept' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Selected concept');
    expect(screen.getByRole('dialog')).toHaveTextContent('Appearance 3 in this round');
    expect(screen.getByRole('button', { name: 'Return to list' })).toBeInTheDocument();
  });

  it('offers Practice after a successful draw and passes its concept, round, and appearance identities', async () => {
    const user = userEvent.setup();
    const startPractice = vi.fn();
    currentConcepts = [existingConcept];
    renderView(startPractice);

    await user.click(await screen.findByRole('button', { name: 'Sortear concepto' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(existingConcept.title);
    await user.click(screen.getByRole('button', { name: 'Practicar' }));

    expect(startPractice).toHaveBeenCalledWith(existingConcept.id, currentRound.id, 'appearance-draw');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('routes a post-save Draw Another request through the existing round draw flow', async () => {
    currentConcepts = [existingConcept];
    const handled = vi.fn();
    renderView(vi.fn(), { id: 41, listId: list.id, action: 'draw' }, handled);

    expect(await screen.findByRole('dialog')).toHaveTextContent(existingConcept.title);
    expect(drawPendingConcept).toHaveBeenCalledWith(list.id);
    expect(handled).toHaveBeenCalledWith(41);
  });

  it('uses the existing new-round confirmation when the saved draw action is stale or a new round was selected', async () => {
    currentConcepts = [{ ...existingConcept, state: 'seen' }];
    renderView(vi.fn(), { id: 42, listId: list.id, action: 'draw' });

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/iniciar una nueva ronda/i);
    expect(drawPendingConcept).not.toHaveBeenCalled();
    await userEvent.setup().click(within(dialog).getByRole('button', { name: /confirmar nueva ronda/i }));
    expect(startNewRound).toHaveBeenCalledWith(list.id);
  });

  it('opens the established confirmation for an explicit post-save Start New Round action', async () => {
    currentConcepts = [existingConcept];
    renderView(vi.fn(), { id: 43, listId: list.id, action: 'new_round' });

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/iniciar una nueva ronda/i);
    expect(startNewRound).not.toHaveBeenCalled();
  });

  it('shows empty and numeric pending progress without hiding Add Concepts', async () => {
    currentConcepts = [];
    renderView();

    expect(await screen.findByText('Esta lista todavía no tiene conceptos. Agrega uno o pega varios para comenzar.')).toBeInTheDocument();
    expect(await screen.findByRole('progressbar', { name: 'Vistos: 0 · Pendientes: 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar conceptos' })).toBeInTheDocument();
    expect(screen.getByText('Agrega conceptos para iniciar el repaso de esta lista.')).toBeInTheDocument();
  });

  it('shows text states and marks pending concepts only after confirmation', async () => {
    const user = userEvent.setup();
    const seenConcept = { ...existingConcept, id: 'concept-seen', title: 'Física', state: 'seen' as const };
    currentConcepts = [existingConcept, seenConcept];
    renderView();

    expect(await screen.findByRole('progressbar', { name: 'Vistos: 1 · Pendientes: 1' })).toBeInTheDocument();
    expect(screen.getByText('Pendiente', { selector: '[data-round-state]' })).toBeInTheDocument();
    expect(screen.getByText('Visto', { selector: '[data-round-state]' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marcar Anatomía como visto' }));

    expect(markConceptSeen).toHaveBeenCalledWith(list.id, existingConcept.id);
    expect(await screen.findByRole('status')).toHaveTextContent('Progreso actualizado.');
    expect(screen.getByRole('button', { name: 'Ver Anatomía' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devolver Física a pendientes' })).toBeInTheDocument();
  });

  it('returns seen concepts to pending and reports a rejected action', async () => {
    const user = userEvent.setup();
    currentConcepts = [{ ...existingConcept, state: 'seen' }];
    vi.mocked(returnConceptToPending).mockResolvedValueOnce({
      status: 'rejected', error: new DomainServiceError('round_action_rejected', 'round_action_rejected'),
      result: {
        action: 'return_pending', outcome: 'rejected', round_id: currentRound.id,
        appearance_id: null, appearance_order: null, concept_id: null, title: null,
        result_state: 'seen', pending_count: 0, seen_count: 1,
      },
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Devolver Anatomía a pendientes' }));

    expect(returnConceptToPending).toHaveBeenCalledWith(list.id, existingConcept.id);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la acción de ronda. No se aplicaron cambios.');
    expect(screen.getByRole('progressbar', { name: 'Vistos: 1 · Pendientes: 0' })).toBeInTheDocument();
  });

  it('reports a confirmed return-to-pending action', async () => {
    const user = userEvent.setup();
    currentConcepts = [{ ...existingConcept, state: 'seen' }];
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Devolver Anatomía a pendientes' }));

    expect(returnConceptToPending).toHaveBeenCalledWith(list.id, existingConcept.id);
    expect(await screen.findByText('Progreso actualizado.')).toBeInTheDocument();
  });

  it('disables round actions while a command is processing', async () => {
    const user = userEvent.setup();
    let resolveAction!: (result: RoundCommandResult) => void;
    vi.mocked(markConceptSeen).mockReturnValueOnce(new Promise((resolve) => {
      resolveAction = resolve;
    }));
    currentConcepts = [existingConcept];
    renderView();

    const markButton = await screen.findByRole('button', { name: 'Marcar Anatomía como visto' });
    await user.click(markButton);

    expect(await screen.findByText('Actualizando progreso…')).toBeInTheDocument();
    expect(markButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ver Anatomía' })).toBeEnabled();
    resolveAction({
      status: 'confirmed', result: {
        action: 'mark_seen', outcome: 'applied', round_id: currentRound.id,
        appearance_id: 'appearance-a', appearance_order: 1,
        concept_id: existingConcept.id, title: existingConcept.title,
        result_state: 'seen', pending_count: 0, seen_count: 1,
      },
    });
    expect(await screen.findByText('Progreso actualizado.')).toBeInTheDocument();
  });

  it('keeps unresolved actions recoverable and disables conflicting commands until retry resolves', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(markConceptSeen).mockResolvedValueOnce({
      status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved'),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Marcar Anatomía como visto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se confirmó el cambio. Reintenta la misma acción.');
    expect(screen.getByRole('button', { name: 'Marcar Anatomía como visto' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retryUnresolvedRoundOperation).toHaveBeenCalledWith(list.id);
    expect(await screen.findByRole('status')).toHaveTextContent('Progreso actualizado.');
  });

  it('shows the exhausted text state and localizes round controls in English', async () => {
    currentConcepts = [{ ...existingConcept, state: 'seen' }];
    renderView();
    expect(await screen.findByText('Todos los conceptos activos están vistos.')).toBeInTheDocument();

    await i18n.changeLanguage('en');
    expect(await screen.findByRole('progressbar', { name: 'Seen: 1 · Pending: 0' })).toBeInTheDocument();
    expect(screen.getByText('All active concepts have been seen.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return Anatomía to pending' })).toBeInTheDocument();
  });

  it('shows the session-expired round error and retries round loading', async () => {
    const user = userEvent.setup();
    vi.mocked(loadCurrentRound).mockRejectedValueOnce(
      new DomainServiceError('unauthenticated', 'unauthenticated'),
    );
    currentConcepts = [existingConcept];
    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró. Inicia sesión de nuevo para continuar.');
    expect(screen.getByRole('button', { name: 'Marcar Anatomía como visto' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByRole('progressbar', { name: 'Vistos: 0 · Pendientes: 1' })).toBeInTheDocument();
  });

  it('shows an empty list and saves an individual concept with its description', async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Esta lista todavía no tiene conceptos. Agrega uno o pega varios para comenzar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar conceptos' }));
    await user.type(await screen.findByRole('textbox', { name: 'Título del concepto' }), 'Biología');
    await user.type(screen.getByRole('textbox', { name: 'Descripción (opcional)' }), 'Estudio de la vida');
    await user.click(screen.getByRole('button', { name: 'Guardar concepto' }));

    await waitFor(() => expect(vi.mocked(createConcept).mock.calls[0]?.[0]).toEqual({
      userId: 'user-a', listId: list.id, title: 'Biología', description: 'Estudio de la vida',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Concepto guardado.');
  });

  it('clears a saved feedback message automatically', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Agregar conceptos' }));
    const title = await screen.findByRole('textbox', { name: 'Título del concepto' });
    vi.useFakeTimers();
    fireEvent.change(title, { target: { value: 'Biología' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar concepto' }));

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole('status')).toHaveTextContent('Concepto guardado.');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.queryByText('Concepto guardado.')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('keeps the batch local until explicit confirmation and reports accepted and omitted lines', async () => {
    const user = userEvent.setup();
    vi.mocked(getOwnedConcepts).mockResolvedValue([existingConcept]);
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Agregar conceptos' }));
    await user.click(await screen.findByRole('radio', { name: 'Por lote' }));
    await user.type(screen.getByRole('textbox', { name: 'Pega conceptos, uno por línea' }), '- Biología : Ciencia de la vida\n- Anatomía\nInválida');
    await user.click(screen.getByRole('button', { name: 'Revisar lote' }));

    expect(await screen.findByText('Biología')).toBeInTheDocument();
    expect(screen.getByText('El título ya existe en esta lista o en el lote.')).toBeInTheDocument();
    expect(screen.getByText('La línea debe comenzar con un guion.')).toBeInTheDocument();
    expect(createConceptBatch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar lote' }));
    await waitFor(() => expect(createConceptBatch).toHaveBeenCalledTimes(1));
    expect(createConceptBatch).toHaveBeenCalledWith('user-a', list.id, expect.objectContaining({
      accepted: [{ sourceIndex: 0, title: 'Biología', description: 'Ciencia de la vida' }],
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se guardaron 1 conceptos.');
    expect(screen.getByRole('button', { name: 'Lote guardado' })).toBeDisabled();
  });

  it('rejects an oversized batch before allowing confirmation', async () => {
    const user = userEvent.setup();
    renderView();

    await screen.findByText('Esta lista todavía no tiene conceptos. Agrega uno o pega varios para comenzar.');
    await user.click(screen.getByRole('button', { name: 'Agregar conceptos' }));
    await user.click(await screen.findByRole('radio', { name: 'Por lote' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pega conceptos, uno por línea' }), { target: { value: `-${'x'.repeat(20000)}` } });
    await user.click(screen.getByRole('button', { name: 'Revisar lote' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El lote no puede superar 20.000 caracteres.');
    expect(screen.getByRole('button', { name: 'Confirmar y guardar lote' })).toBeDisabled();
    expect(createConceptBatch).not.toHaveBeenCalled();
  });

  it('opens a concept and saves an edit with its stable id, state, and expected timestamp', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    const updated = { ...existingConcept, title: 'Biología', description: 'Ciencia de la vida', updated_at: '2026-01-02T00:00:00Z' };
    vi.mocked(updateConcept).mockImplementation(async () => {
      currentConcepts = [updated];
      return { status: 'updated', concept: updated };
    });
    renderView();

    expect(await screen.findByText('Pendiente')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Ver Anatomía' }));
    await screen.findByText('Estudio del cuerpo');
    expect(screen.getByRole('heading', { name: 'Anatomía', level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar concepto' }));
    const title = screen.getByRole('textbox', { name: 'Título del concepto' });
    await user.clear(title);
    await user.type(title, 'Biología');
    const description = screen.getByRole('textbox', { name: 'Descripción del concepto' });
    await user.clear(description);
    await user.type(description, 'Ciencia de la vida');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(vi.mocked(updateConcept).mock.calls[0]?.[0]).toEqual({
      userId: 'user-a', listId: list.id, conceptId: existingConcept.id,
      title: 'Biología', description: 'Ciencia de la vida', expectedUpdatedAt: existingConcept.updated_at,
    }));
    expect(await screen.findByRole('heading', { name: 'Biología', level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('keeps a stale edit visible and reloads the latest confirmed version on request', async () => {
    const user = userEvent.setup();
    const currentVersion = { ...existingConcept, title: 'Anatomía humana', updated_at: '2026-01-03T00:00:00Z' };
    currentConcepts = [existingConcept];
    vi.mocked(updateConcept).mockResolvedValue({
      status: 'rejected', error: new DomainServiceError('concept_conflict', 'concept_conflict'),
    });
    vi.mocked(getOwnedConcepts).mockImplementation(async () => currentConcepts);
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Ver Anatomía' }));
    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Editar concepto' }));
    const title = screen.getByRole('textbox', { name: 'Título del concepto' });
    await user.clear(title);
    await user.type(title, 'Anatomía comparada');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este concepto cambió en otra sesión.');
    expect(title).toHaveValue('Anatomía comparada');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar cambios' })).toBeDisabled();
    currentConcepts = [currentVersion];
    await user.click(screen.getByRole('button', { name: 'Recargar versión actual' }));
    expect(await screen.findByRole('textbox', { name: 'Título del concepto' })).toHaveValue('Anatomía humana');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect(updateConcept).toHaveBeenCalledTimes(1);
  });

  it('keeps an invalid edit available for correction without calling the service', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Ver Anatomía' }));
    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Editar concepto' }));
    const title = screen.getByRole('textbox', { name: 'Título del concepto' });
    await user.clear(title);
    await user.type(title, '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(screen.getByText('El título debe tener entre 1 y 50 caracteres.')).toBeInTheDocument();
    expect(title).toHaveValue('   ');
    expect(updateConcept).not.toHaveBeenCalled();
  });

  it('keeps a duplicate edit available and does not show a saved state', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(updateConcept).mockResolvedValue({
      status: 'rejected', error: new DomainServiceError('concept_duplicate', 'concept_duplicate'),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Ver Anatomía' }));
    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Editar concepto' }));
    const title = screen.getByRole('textbox', { name: 'Título del concepto' });
    await user.clear(title);
    await user.type(title, 'Anatomía');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un concepto con ese título.');
    expect(title).toHaveValue('Anatomía');
    expect(screen.queryByText('Cambios guardados.')).not.toBeInTheDocument();
  });

  it('does not delete on cancellation and shows success only after a confirmed tombstone result', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(deleteConcept).mockImplementation(async () => {
      currentConcepts = [];
      return { status: 'deleted', concept: null };
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Ver Anatomía' }));
    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Eliminar concepto' }));
    expect(await screen.findByRole('dialog', {}, { timeout: 3000 })).toHaveTextContent('El concepto dejará de estar activo en esta lista.');
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }, { timeout: 3000 }));
    expect(deleteConcept).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Anatomía', level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar concepto' }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }, { timeout: 3000 }));
    await waitFor(() => expect(deleteConcept).toHaveBeenCalledWith({
      userId: 'user-a', listId: list.id, conceptId: existingConcept.id,
      expectedUpdatedAt: existingConcept.updated_at,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Concepto eliminado de la lista.');
    expect(screen.queryByText('Estudio del cuerpo')).not.toBeInTheDocument();
  }, 10000);

  it('keeps delete confirmation recoverable on an uncertain result and allows a safe retry', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(deleteConcept)
      .mockResolvedValueOnce({ status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved'), reconciliation: 'failed' })
      .mockImplementationOnce(async () => { currentConcepts = []; return { status: 'deleted', concept: null }; });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Ver Anatomía' }));
    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Eliminar concepto' }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }, { timeout: 3000 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar la eliminación.');
    expect(screen.getByRole('heading', { name: 'Anatomía', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Concepto eliminado de la lista.')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }, { timeout: 3000 }));
    await waitFor(() => expect(deleteConcept).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status')).toHaveTextContent('Concepto eliminado de la lista.');
  }, 10000);

  it('connects the authenticated list detail to the concept collection and preserves its back action', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    currentConcepts = [existingConcept];
    const detailProps = { list, userId: 'user-a', onBack, onStartPractice: vi.fn() };
    queryClient.clear();
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test"><ToastProvider><ListDetailView {...detailProps} /><ToastViewport /></ToastProvider></MantineProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Anatomía', level: 1 })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Ver Anatomía' }));
    expect(await screen.findByText('Estudio del cuerpo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(vi.mocked(getOwnedConcepts).mock.calls.at(-1)).toEqual(['user-a', list.id]);
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('describes account data, deletion and planned Free plan limits in both privacy locales', () => {
    const spanish = resources.es.translation.privacy;
    const english = resources.en.translation.privacy;

    expect(spanish.data).toContain('títulos y descripciones de conceptos');
    expect(english.data).toContain('concept titles and descriptions');
    expect(spanish.session).toContain('El navegador guarda la sesión');
    expect(english.session).toContain('Your browser stores the Chucao session');
    expect(spanish.retention).toContain('Preferencias → Cuenta');
    expect(english.retention).toContain('Preferences → Account');
    expect(spanish.deletionDetails).toContain('referencia al concepto eliminado');
    expect(english.deletionDetails).toContain('reference to the deleted concept');
    expect(spanish.backups).toContain('no incluye backups programados');
    expect(english.backups).toContain('neither scheduled backups nor point-in-time recovery');
  });

  it('renders concept controls in English while preserving the user-authored list name', async () => {
    await i18n.changeLanguage('en');
    currentConcepts = [];
    const detailProps = { list, userId: 'user-a', onBack: vi.fn(), onStartPractice: vi.fn() };
    queryClient.clear();
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test"><ToastProvider><ListDetailView {...detailProps} /><ToastViewport /></ToastProvider></MantineProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Anatomía', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('This list has no concepts yet. Add one or paste several to get started.')).toBeInTheDocument();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Add concepts' }));
    expect(await screen.findByRole('textbox', { name: 'Concept title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('localizes an expired session state when the selected concept list cannot load', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(getOwnedConcepts).mockRejectedValue(new DomainServiceError('unauthenticated', 'unauthenticated'));
    const detailProps = { list, userId: 'user-a', onBack: vi.fn(), onStartPractice: vi.fn() };
    queryClient.clear();
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider env="test"><ToastProvider><ListDetailView {...detailProps} /><ToastViewport /></ToastProvider></MantineProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session expired. Sign in again to continue.');
    await i18n.changeLanguage('es');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró. Inicia sesión de nuevo para continuar.');
  });
});
