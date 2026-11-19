import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/i18n';
import { PracticeNoteEditor } from './PracticeNoteEditor';

const { getSavedPractice, updatePracticeNote, deletePracticeNote } = vi.hoisted(() => ({
  getSavedPractice: vi.fn(), updatePracticeNote: vi.fn(), deletePracticeNote: vi.fn(),
}));
vi.mock('./practiceService', () => ({ getSavedPractice, updatePracticeNote, deletePracticeNote, practiceQueryKey: (userId: string, id: string) => ['practice', userId, id] }));

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MantineProvider><I18nextProvider i18n={i18n}><PracticeNoteEditor userId="owner-1" practiceId="practice-1" onClose={vi.fn()} /></I18nextProvider></MantineProvider></QueryClientProvider>);
}

describe('PracticeNoteEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    void i18n.changeLanguage('es');
    getSavedPractice.mockResolvedValue({ practice: { id: 'practice-1', rating: 4, title_snapshot: '<script>texto</script>' }, note: 'Nota actual', noteRevision: 1 });
  });

  it('cancels an edit without changing the saved note, and rejects empty text', async () => {
    renderEditor();
    expect(await screen.findByText('Nota actual')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota de práctica' }), { target: { value: 'Borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cambios' }));
    expect(screen.getByText('Nota actual')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota de práctica' }), { target: { value: ' \n ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('La nota no puede estar vacía.')).toBeInTheDocument();
    expect(updatePracticeNote).not.toHaveBeenCalled();
  });

  it('saves explicitly and renders HTML-like note text as inert content', async () => {
    getSavedPractice.mockResolvedValue({ practice: { id: 'practice-1', rating: 4 }, note: '<img src=x onerror=alert(1)>', noteRevision: 1 });
    updatePracticeNote.mockResolvedValue({ status: 'confirmed', outcome: 'updated', note: 'Nota revisada', revision: 2 });
    renderEditor();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota de práctica' }), { target: { value: 'Nota revisada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(updatePracticeNote).toHaveBeenCalledWith(expect.objectContaining({ body: 'Nota revisada', expectedRevision: 1 })));
    expect(await screen.findByText('Nota revisada')).toBeInTheDocument();
  });

  it('requires separate delete confirmation and leaves the note untouched when cancelled', async () => {
    deletePracticeNote.mockResolvedValue({ status: 'confirmed', outcome: 'deleted', note: null, revision: null });
    renderEditor();
    await screen.findByText('Nota actual');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nota' }));
    fireEvent.click(await screen.findByRole('button', { name: /Cancel/ }));
    expect(deletePracticeNote).not.toHaveBeenCalled();
    expect(screen.getByText('Nota actual')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nota' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() => expect(deletePracticeNote).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1 })));
    expect(await screen.findByText('Esta práctica ya no tiene una nota guardada.')).toBeInTheDocument();
  });

  it('keeps the draft on a stale revision and lets the user reapply against current state', async () => {
    updatePracticeNote
      .mockResolvedValueOnce({ status: 'rejected', reason: 'stale', note: 'Versión más nueva', revision: 2 })
      .mockResolvedValueOnce({ status: 'confirmed', outcome: 'updated', note: 'Mi borrador', revision: 3 });
    renderEditor();
    await screen.findByText('Nota actual');
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota de práctica' }), { target: { value: 'Mi borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Versión más nueva')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nota de práctica' })).toHaveValue('Mi borrador');
    fireEvent.click(screen.getByRole('button', { name: 'Reaplicar mi borrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(updatePracticeNote).toHaveBeenLastCalledWith(expect.objectContaining({ body: 'Mi borrador', expectedRevision: 2 })));
    expect(await screen.findByText('Mi borrador')).toBeInTheDocument();
  });

  it('retries an unresolved save with the same operation identity and retained draft', async () => {
    updatePracticeNote
      .mockResolvedValueOnce({ status: 'unresolved', operationId: 'retry-id', error: new Error('generic') })
      .mockResolvedValueOnce({ status: 'confirmed', outcome: 'updated', note: 'Borrador', revision: 2 });
    renderEditor();
    await screen.findByText('Nota actual');
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota de práctica' }), { target: { value: 'Borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar guardado' }));
    await waitFor(() => expect(updatePracticeNote).toHaveBeenCalledTimes(2));
    expect(updatePracticeNote.mock.calls[0][0].operationId).toBe(updatePracticeNote.mock.calls[1][0].operationId);
  });
});
