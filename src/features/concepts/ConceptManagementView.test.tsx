import { MantineProvider } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveConceptRow, ListRow } from '../../lib/database.types';
import { queryClient } from '../../lib/queryClient';
import i18n from '../../i18n/i18n';
import { resources } from '../../i18n/resources';
import { ConceptManagementView } from './ConceptManagementView';
import { ListDetailView } from '../lists/ListDetailView';
import { createConcept, createConceptBatch, deleteConcept, getOwnedConcepts, updateConcept } from './conceptService';
import { DomainServiceError } from '../shared/supabaseErrors';

vi.mock('./conceptService', () => ({
  conceptQueryKey: (userId: string, listId: string) => ['concepts', userId, listId],
  getOwnedConcepts: vi.fn(),
  createConcept: vi.fn(),
  createConceptBatch: vi.fn(),
  updateConcept: vi.fn(),
  deleteConcept: vi.fn(),
}));

const list = { id: 'list-a', name: 'Anatomía', owner_id: 'user-a' } as ListRow;
const existingConcept: ActiveConceptRow = {
  id: 'concept-1', list_id: list.id, title: 'Anatomía', description: 'Estudio del cuerpo',
  state: 'pending', position: 0, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', deleted_at: null,
};
let currentConcepts: ActiveConceptRow[] = [];

function renderView() {
  queryClient.clear();
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ConceptManagementView userId="user-a" list={list} onBack={vi.fn()} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('ConceptManagementView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
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
  });

  afterEach(() => { vi.clearAllMocks(); queryClient.clear(); });

  it('shows an empty list and saves an individual concept with its description', async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText('Esta lista todavía no tiene conceptos. Agrega uno o pega varios para comenzar.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Título del concepto' }), 'Biología');
    await user.type(screen.getByRole('textbox', { name: 'Descripción (opcional)' }), 'Estudio de la vida');
    await user.click(screen.getByRole('button', { name: 'Guardar concepto' }));

    await waitFor(() => expect(vi.mocked(createConcept).mock.calls[0]?.[0]).toEqual({
      userId: 'user-a', listId: list.id, title: 'Biología', description: 'Estudio de la vida',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Concepto guardado.');
  });

  it('clears a saved feedback message automatically', async () => {
    renderView();
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

    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('radio', { name: 'Por lote' }));
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
    await user.click(screen.getByRole('radio', { name: 'Por lote' }));
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

    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Ver Anatomía' }));
    expect(screen.getByRole('heading', { name: 'Anatomía', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'Biología', level: 2 })).toBeInTheDocument();
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

    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Ver Anatomía' }));
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

    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Ver Anatomía' }));
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

    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Ver Anatomía' }));
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

    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Ver Anatomía' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar concepto' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('El concepto dejará de estar activo en esta lista.');
    await user.click(screen.getByRole('button', { name: 'Cancelar eliminación' }));
    expect(deleteConcept).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Anatomía', level: 2 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar concepto' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() => expect(deleteConcept).toHaveBeenCalledWith({
      userId: 'user-a', listId: list.id, conceptId: existingConcept.id,
      expectedUpdatedAt: existingConcept.updated_at,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Concepto eliminado de la lista.');
    expect(screen.queryByText('Estudio del cuerpo')).not.toBeInTheDocument();
  });

  it('keeps delete confirmation recoverable on an uncertain result and allows a safe retry', async () => {
    const user = userEvent.setup();
    currentConcepts = [existingConcept];
    vi.mocked(deleteConcept)
      .mockResolvedValueOnce({ status: 'unresolved', error: new DomainServiceError('unresolved', 'unresolved'), reconciliation: 'failed' })
      .mockImplementationOnce(async () => { currentConcepts = []; return { status: 'deleted', concept: null }; });
    renderView();

    await screen.findByText('Estudio del cuerpo');
    await user.click(screen.getByRole('button', { name: 'Ver Anatomía' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar concepto' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar eliminación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar la eliminación.');
    expect(screen.getByRole('heading', { name: 'Anatomía', level: 2 })).toBeInTheDocument();
    expect(screen.queryByText('Concepto eliminado de la lista.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() => expect(deleteConcept).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status')).toHaveTextContent('Concepto eliminado de la lista.');
  });

  it('connects the authenticated list detail to the concept collection and preserves its back action', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    currentConcepts = [existingConcept];
    const detailProps = { list, userId: 'user-a', onBack };
    queryClient.clear();
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider><ListDetailView {...detailProps} /></MantineProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Anatomía', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Estudio del cuerpo')).toBeInTheDocument();
    expect(vi.mocked(getOwnedConcepts).mock.calls.at(-1)).toEqual(['user-a', list.id]);
    await user.click(screen.getByRole('button', { name: 'Volver a Mis listas' }));
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
        <MantineProvider><ListDetailView {...detailProps} /></MantineProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Anatomía', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('This list has no concepts yet. Add one or paste several to get started.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Concept title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to My Lists' })).toBeInTheDocument();
  });

  it('localizes an expired session state when the selected concept list cannot load', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(getOwnedConcepts).mockRejectedValue(new DomainServiceError('unauthenticated', 'unauthenticated'));
    const detailProps = { list, userId: 'user-a', onBack: vi.fn() };
    queryClient.clear();
    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider><ListDetailView {...detailProps} /></MantineProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session expired. Sign in again to continue.');
    await i18n.changeLanguage('es');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró. Inicia sesión de nuevo para continuar.');
  });
});
