import { MantineProvider } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveConceptRow, ListRow } from '../../lib/database.types';
import type { RoundCommandResult } from '../rounds/roundService';
import { queryClient } from '../../lib/queryClient';
import i18n from '../../i18n/i18n';
import { resources } from '../../i18n/resources';
import { ConceptManagementView } from './ConceptManagementView';
import { ListDetailView } from '../lists/ListDetailView';
import { createConcept, createConceptBatch, deleteConcept, getOwnedConcepts, updateConcept } from './conceptService';
import { DomainServiceError } from '../shared/supabaseErrors';
import { ToastProvider, ToastViewport } from '../../app/toasts/ToastProvider';
import {
  drawPendingConcept,
  loadCurrentRound,
  markConceptSeen,
  returnConceptToPending,
  retryUnresolvedRoundOperation,
  startNewRound,
} from '../rounds/roundService';

vi.mock('./conceptService', () => ({
  conceptQueryKey: (userId: string, listId: string) => ['concepts', userId, listId],
  getOwnedConcepts: vi.fn(),
  createConcept: vi.fn(),
  createConceptBatch: vi.fn(),
  updateConcept: vi.fn(),
  deleteConcept: vi.fn(),
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

function renderView() {
  queryClient.clear();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider env="test">
        <ToastProvider>
          <ConceptManagementView userId="user-a" list={list} onBack={vi.fn()} />
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
    expect(screen.queryByRole('button', { name: /practicar/i })).not.toBeInTheDocument();
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
    const detailProps = { list, userId: 'user-a', onBack };
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

  it('describes concept data and local review limits in both privacy locales', () => {
    const spanish = resources.es.translation.privacy;
    const english = resources.en.translation.privacy;
    expect(spanish.data).toContain('títulos y descripciones de los conceptos');
    expect(spanish.purposes).toContain('organizar tus conceptos en listas privadas');
    expect(spanish.retention).toContain('marcador mínimo');
    expect(spanish.retention).toContain('título y la descripción');
    expect(spanish.intro).toContain('slice local VS-02');
    expect(spanish.intro).toContain('revisión local');
    expect(spanish.intro).toContain('no reemplaza la publicación legal definitiva');
    expect(english.data).toContain('titles and descriptions of concepts you write');
    expect(english.purposes).toContain('organizing concepts in your private lists');
    expect(english.retention).toContain('minimal deletion marker');
    expect(english.retention).toContain('title and description');
    expect(english.intro).toContain('local Chucao Web VS-02 slice');
    expect(english.intro).toContain('local review content');
    expect(english.intro).toContain('does not replace the final legal publication');
  });

  it('renders concept controls in English while preserving the user-authored list name', async () => {
    await i18n.changeLanguage('en');
    currentConcepts = [];
    const detailProps = { list, userId: 'user-a', onBack: vi.fn() };
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
    const detailProps = { list, userId: 'user-a', onBack: vi.fn() };
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
