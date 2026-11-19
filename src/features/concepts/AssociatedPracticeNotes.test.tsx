import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/i18n';
import { AssociatedPracticeNotes } from './AssociatedPracticeNotes';

const { listPracticeHistory, getSavedPractice, deletePracticeNote } = vi.hoisted(() => ({ listPracticeHistory: vi.fn(), getSavedPractice: vi.fn(), deletePracticeNote: vi.fn() }));
vi.mock('../history/historyService', () => ({ listPracticeHistory }));
vi.mock('../practice/practiceService', () => ({ getSavedPractice, practiceQueryKey: (userId: string, id: string) => ['practice', userId, id], updatePracticeNote: vi.fn(), deletePracticeNote }));

function renderNotes(props: { activeConceptIds?: string[]; conceptId?: string; deletedConcepts?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MantineProvider><I18nextProvider i18n={i18n}><AssociatedPracticeNotes userId="owner-1" listId="list-1" {...props} /></I18nextProvider></MantineProvider></QueryClientProvider>);
}

describe('AssociatedPracticeNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    void i18n.changeLanguage('es');
    listPracticeHistory.mockResolvedValue({
      items: [{ id: 'practice-1', kind: 'associated', listId: 'list-1', conceptId: null, titleSnapshot: '<b>Concepto borrado</b>', independentLabel: null, completedAt: '2026-01-01T12:00:00Z', durationMinutes: 5, rating: 0, hasNote: true }],
      hasMore: false, nextCursor: null,
    });
    getSavedPractice.mockResolvedValue({ practice: { id: 'practice-1', title_snapshot: '<b>Concepto borrado</b>' }, note: 'Texto privado', noteRevision: 1 });
    deletePracticeNote.mockResolvedValue({ status: 'confirmed', outcome: 'deleted', note: null, revision: null });
  });

  it('shows only notes for the selected concept in concept context', async () => {
    listPracticeHistory.mockResolvedValue({ items: [
      { id: 'practice-1', kind: 'associated', conceptId: 'concept-1', titleSnapshot: 'Concepto actual', completedAt: '2026-01-01T12:00:00Z', hasNote: true },
      { id: 'practice-2', kind: 'associated', conceptId: 'concept-2', titleSnapshot: 'Otro concepto', completedAt: '2026-01-02T12:00:00Z', hasNote: true },
    ], hasMore: false, nextCursor: null });
    renderNotes({ conceptId: 'concept-1' });
    expect(await screen.findByText('Concepto actual')).toBeInTheDocument();
    expect(screen.queryByText('Otro concepto')).not.toBeInTheDocument();
    expect(listPracticeHistory).toHaveBeenCalledWith(expect.objectContaining({ conceptId: 'concept-1', listId: 'list-1' }));
  });

  it('keeps deleted-concept notes available in the dedicated list context', async () => {
    renderNotes({ deletedConcepts: true, activeConceptIds: ['concept-live'] });
    expect(await screen.findByText('<b>Concepto borrado</b>')).toBeInTheDocument();
    expect(screen.getAllByText('Concepto eliminado').length).toBeGreaterThan(0);
    expect(screen.queryByText('Texto privado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Administrar nota' }));
    expect(await screen.findByText('Texto privado')).toBeInTheDocument();
    expect(getSavedPractice).toHaveBeenCalledWith('practice-1');
  });

  it('filters entries with no saved note and provides the localized empty state', async () => {
    listPracticeHistory.mockResolvedValue({ items: [{ id: 'practice-2', hasNote: false }], hasMore: false, nextCursor: null });
    renderNotes({ conceptId: 'concept-1' });
    expect(await screen.findByText(i18n.t('practiceNote.conceptEmpty'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administrar nota' })).not.toBeInTheDocument();
  });

  it('removes a deleted note from the list context after confirmed deletion', async () => {
    listPracticeHistory
      .mockResolvedValueOnce({ items: [{ id: 'practice-1', kind: 'associated', listId: 'list-1', conceptId: 'concept-1', titleSnapshot: 'Concepto', independentLabel: null, completedAt: '2026-01-01T12:00:00Z', durationMinutes: 5, rating: 0, hasNote: true }], hasMore: false, nextCursor: null })
      .mockResolvedValue({ items: [{ id: 'practice-1', kind: 'associated', listId: 'list-1', conceptId: 'concept-1', titleSnapshot: 'Concepto', independentLabel: null, completedAt: '2026-01-01T12:00:00Z', durationMinutes: 5, rating: 0, hasNote: false }], hasMore: false, nextCursor: null });
    renderNotes({ conceptId: 'concept-1' });
    fireEvent.click(await screen.findByRole('button', { name: 'Administrar nota' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar nota' }));
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('practiceNote.confirmDelete') }));
    expect(await screen.findByText(i18n.t('practiceNote.conceptEmpty'))).toBeInTheDocument();
    expect(deletePracticeNote).toHaveBeenCalledWith(expect.objectContaining({ practiceId: 'practice-1', expectedRevision: 1 }));
  });

  it('shows only deleted-concept notes in the deleted notes context', async () => {
    listPracticeHistory.mockResolvedValue({ items: [
      { id: 'practice-1', kind: 'associated', conceptId: null, titleSnapshot: 'Concepto eliminado', completedAt: '2026-01-01T12:00:00Z', hasNote: true },
      { id: 'practice-2', kind: 'associated', conceptId: 'concept-live', titleSnapshot: 'Concepto vigente', completedAt: '2026-01-02T12:00:00Z', hasNote: true },
    ], hasMore: false, nextCursor: null });
    renderNotes({ deletedConcepts: true, activeConceptIds: ['concept-live'] });
    expect((await screen.findAllByText('Concepto eliminado')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Concepto vigente')).not.toBeInTheDocument();
    expect(screen.getByText('Notas de conceptos eliminados')).toBeInTheDocument();
  });
});
