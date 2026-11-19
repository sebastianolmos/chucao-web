import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/i18n';
import { HistoryView } from './HistoryView';

const { listPracticeHistory, listRoundHistory, getSavedPractice, deletePracticeNote } = vi.hoisted(() => ({ listPracticeHistory: vi.fn(), listRoundHistory: vi.fn(), getSavedPractice: vi.fn(), deletePracticeNote: vi.fn() }));
vi.mock('./historyService', () => ({ listPracticeHistory, listRoundHistory }));
vi.mock('../lists/listService', () => ({ getOwnedLists: vi.fn().mockResolvedValue([]) }));
vi.mock('../concepts/conceptService', () => ({ getOwnedConcepts: vi.fn().mockResolvedValue([]) }));
vi.mock('../practice/practiceService', () => ({
  getSavedPractice,
  updatePracticeNote: vi.fn(),
  deletePracticeNote,
  practiceQueryKey: (userId: string, id: string) => ['practice', userId, id],
}));

function renderView(userId = 'owner') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderForUser = (ownerId: string) => <MantineProvider><QueryClientProvider client={queryClient}><I18nextProvider i18n={i18n}><HistoryView userId={ownerId} /></I18nextProvider></QueryClientProvider></MantineProvider>;
  const view = render(renderForUser(userId));
  return { ...view, switchOwner: (ownerId: string) => view.rerender(renderForUser(ownerId)) };
}

describe('HistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    void i18n.changeLanguage('es');
    listPracticeHistory.mockResolvedValue({ items: [{ id: 'p0', kind: 'independent', independentLabel: 'Repaso', completedAt: '2026-01-01T12:00:00Z', durationMinutes: 5, rating: 0, hasNote: true }], hasMore: false, nextCursor: null });
    listRoundHistory.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
    getSavedPractice.mockResolvedValue({ practice: { id: 'p0', rating: 0, kind: 'independent', independent_label: 'Repaso' }, note: 'Nota privada', noteRevision: 1 });
    deletePracticeNote.mockResolvedValue({ status: 'confirmed', outcome: 'deleted', note: null, revision: null });
  });

  it('shows the explicit zero rating and passes resettable filters to the history query', async () => {
    renderView();
    expect(await screen.findByText(/Calificación 0/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Etiqueta independiente'), { target: { value: 'Repaso' } });
    expect(await screen.findByDisplayValue('Repaso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    expect(listPracticeHistory).toHaveBeenLastCalledWith({});
  });

  it('shows ordered round appearance origin and deleted status', async () => {
    listRoundHistory.mockResolvedValue({ items: [{ id: 'r1', listName: 'Lista', status: 'closed', openedAt: '2026-01-01T12:00:00Z', appearances: [{ id: 'a1', titleSnapshot: 'Título guardado', conceptDeleted: true, origin: 'manual' }] }], hasMore: false, nextCursor: null });
    renderView();
    fireEvent.click(screen.getByRole('tab', { name: 'Rondas' }));
    expect(await screen.findByText(/Título guardado/)).toBeInTheDocument();
    expect(screen.getByText(/Concepto eliminado/)).toBeInTheDocument();
    expect(screen.getByText(/Marcado manualmente/)).toBeInTheDocument();
  });

  it('opens an independent note detail, deletes the note, and returns with filters and presence refreshed', async () => {
    let hasNote = true;
    listPracticeHistory.mockImplementation(async (filters: { independentLabel?: string | null }) => ({
      items: [{ id: 'p0', kind: 'independent', independentLabel: 'Repaso', completedAt: '2026-01-01T12:00:00Z', durationMinutes: 5, rating: 0, hasNote }],
      hasMore: false,
      nextCursor: null,
      queryKey: ['practice-history', 'owner', filters],
    }));
    deletePracticeNote.mockImplementation(async () => {
      hasNote = false;
      return { status: 'confirmed', outcome: 'deleted', note: null, revision: null };
    });
    renderView();

    fireEvent.change(screen.getByLabelText(i18n.t('history.labelFilter')), { target: { value: 'Repaso' } });
    const openButton = await screen.findByRole('button', { name: i18n.t('history.openNote', { label: 'Repaso' }) });
    fireEvent.click(openButton);

    expect(await screen.findByRole('heading', { name: 'Repaso' })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('history.ratingValue', { value: 0 }))).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('history.manageNote') }));
    expect(await screen.findByText('Nota privada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('practiceNote.delete') }));
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('practiceNote.confirmDelete') }));
    expect(await screen.findByText(i18n.t('practiceNote.noSavedNote'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('practiceNote.close') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('history.backToHistory') }));

    expect(await screen.findByDisplayValue('Repaso')).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('history.noNote'), { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('history.openNote', { label: 'Repaso' }) })).not.toBeInTheDocument();
  });

  it('shows a safe unavailable state when the independent practice can no longer be read', async () => {
    getSavedPractice.mockRejectedValueOnce(new Error('record unavailable'));
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('history.openNote', { label: 'Repaso' }) }));
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('history.manageNote') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('practiceNote.loadError'));
    expect(screen.getByRole('button', { name: i18n.t('practiceNote.retry') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('history.backToHistory') })).toBeInTheDocument();
  });

  it('discards the open detail and its draft when the owner changes', async () => {
    const view = renderView();
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('history.openNote', { label: 'Repaso' }) }));
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('history.manageNote') }));
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('practiceNote.edit') }));
    fireEvent.change(screen.getByRole('textbox', { name: i18n.t('practiceNote.textLabel') }), { target: { value: 'Borrador privado' } });

    view.switchOwner('owner-2');

    expect(await screen.findByRole('heading', { name: i18n.t('history.title') })).toBeInTheDocument();
    expect(screen.queryByText('Borrador privado')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: i18n.t('history.practiceDetail') })).not.toBeInTheDocument();
  });
});
