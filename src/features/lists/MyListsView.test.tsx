import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListRow } from '../../lib/database.types';
import i18n from '../../i18n/i18n';
import { ToastProvider } from '../../app/toasts/ToastProvider';
import { MyListsView } from './MyListsView';
import { getListCollectionPage, getOwnedConceptCounts, getOwnedLists, archivePrivateList, deletePrivateList, duplicatePrivateList, renamePrivateList, restorePrivateList } from './listService';
import { DomainServiceError } from '../shared/supabaseErrors';

vi.mock('./listService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./listService')>();
  return {
    ...actual,
    getOwnedLists: vi.fn(),
    getOwnedConceptCounts: vi.fn(),
    getListCollectionPage: vi.fn(),
    renamePrivateList: vi.fn(), archivePrivateList: vi.fn(), restorePrivateList: vi.fn(), duplicatePrivateList: vi.fn(), deletePrivateList: vi.fn(),
    listQueryKey: (userId: string) => ['lists', userId],
    createPrivateList: vi.fn(),
  };
});

const emptyList = { id: 'empty-list', owner_id: 'user-a', name: 'Empty list' } as ListRow;
const populatedList = { id: 'full-list', owner_id: 'user-a', name: 'Biology' } as ListRow;

function renderView(
  lists: ListRow[],
  counts: Record<string, { practiced: number; total: number }>,
  onStartIndependentTimer = vi.fn(),
  failCollectionRead = false,
  onOpenList = vi.fn(),
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(getOwnedLists).mockResolvedValue(lists);
  vi.mocked(getOwnedConceptCounts).mockResolvedValue(counts);
  if (failCollectionRead) vi.mocked(getListCollectionPage).mockRejectedValueOnce(new Error('network unavailable'));
  else vi.mocked(getListCollectionPage).mockResolvedValue({ items: lists, hasMore: false, nextCursor: null });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MantineProvider>
          <MyListsView userId="user-a" onOpenList={onOpenList} onStartIndependentTimer={onStartIndependentTimer} />
        </MantineProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('MyListsView concept progress', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('keeps the whole card as the open action and the overlaid menu separate', async () => {
    const onOpenList = vi.fn();
    renderView([populatedList], {}, vi.fn(), false, onOpenList);
    const card = (await screen.findByText('Biology')).closest('button');
    expect(card).not.toBeNull();
    fireEvent.click(card as HTMLButtonElement);
    expect(onOpenList).toHaveBeenCalledWith(populatedList);
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Biology' }));
    expect(await screen.findByRole('menuitem', { name: 'Renombrar' })).toBeInTheDocument();
    expect(onOpenList).toHaveBeenCalledOnce();
  });

  it('shows total active concepts and zero progress for an empty list', async () => {
    renderView([emptyList, populatedList], {
      [emptyList.id]: { practiced: 0, total: 0 },
      [populatedList.id]: { practiced: 0, total: 4 },
    });

    expect((await screen.findByText('Empty list')).closest('button'))
      .toHaveTextContent('Conceptos practicados 0/0');
    expect((await screen.findByText('Biology')).closest('button'))
      .toHaveTextContent('Conceptos practicados 0/4');
  });

  it('shows practiced concepts in the list card progress', async () => {
    renderView([populatedList], {
      [populatedList.id]: { practiced: 2, total: 4 },
    });

    await waitFor(() => {
      expect(screen.getByText('Biology').closest('button'))
        .toHaveTextContent('Conceptos practicados 2/4');
    });
  });

  it('offers the independent timer when the account has no lists', async () => {
    const startTimer = vi.fn();
    renderView([], {}, startTimer);

    expect(await screen.findByText(/Todavía no tienes listas/i)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Temporizador independiente' }).click();
    expect(startTimer).toHaveBeenCalledOnce();
  });

  it('searches and orders the selected collection through the bounded collection service', async () => {
    renderView([populatedList], {});
    await screen.findByText('Biology');
    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar listas/i }), { target: { value: 'bio' } });
    const orderSelect = document.querySelector('select');
    expect(orderSelect).not.toBeNull();
    fireEvent.change(orderSelect as HTMLSelectElement, { target: { value: 'name_desc' } });
    await waitFor(() => expect(getListCollectionPage).toHaveBeenLastCalledWith('user-a', expect.objectContaining({ collection: 'active', search: 'bio', sort: 'name_desc' })));
  });

  it('shows localized empty-search state separately and switches to archived collection', async () => {
    renderView([], {});
    await screen.findByRole('searchbox', { name: /Buscar listas/i });
    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar listas/i }), { target: { value: 'missing' } });
    await screen.findByText(/No hay listas que coincidan/i);
    fireEvent.click(screen.getByRole('button', { name: 'Archivadas' }));
    await waitFor(() => expect(getListCollectionPage).toHaveBeenLastCalledWith('user-a', expect.objectContaining({ collection: 'archived', search: 'missing' })));
  });

  it('offers list actions through the menu and confirms permanent deletion', async () => {
    vi.mocked(deletePrivateList).mockResolvedValue(undefined);
    renderView([populatedList], {});
    await screen.findByText('Biology');
    fireEvent.click(screen.getByRole('button', { name: /Acciones de Biology/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Eliminar permanentemente/i }));
    expect(await screen.findByText(i18n.t('lists.deleteDescription', { name: 'Biology' }))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('lists.confirmDelete') }));
    await waitFor(() => expect(deletePrivateList).toHaveBeenCalledWith('full-list'));
  });

  it('chooses Archive instead of permanent deletion and confirms archive', async () => {
    vi.mocked(archivePrivateList).mockResolvedValue(populatedList);
    renderView([populatedList], {});
    await screen.findByText('Biology');
    fireEvent.click(screen.getByRole('button', { name: /Acciones de Biology/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Eliminar permanentemente/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(deletePrivateList).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /Archivar en su lugar/i }));
    expect(await screen.findByText(/conservará su contenido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Archivar$/i }));
    await waitFor(() => expect(archivePrivateList).toHaveBeenCalledWith('full-list'));
  });

  it('cancels permanent deletion without calling the delete service', async () => {
    renderView([populatedList], {});
    await screen.findByText('Biology');
    fireEvent.click(screen.getByRole('button', { name: /Acciones de Biology/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Eliminar permanentemente/i }));
    const dialog = await screen.findByRole('dialog');
    const closeButton = dialog.querySelector('button');
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton as HTMLButtonElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deletePrivateList).not.toHaveBeenCalled();
  });

  it('explains restore-at-cap failure and keeps the archived collection visible', async () => {
    const archived = { ...populatedList, archived_at: '2026-01-01T00:00:00Z' };
    vi.mocked(restorePrivateList).mockRejectedValue(new (await import('../shared/supabaseErrors')).DomainServiceError('list_limit', 'list_limit'));
    renderView([archived], {});
    await screen.findByText('Biology');
    fireEvent.click(screen.getByRole('button', { name: 'Archivadas' }));
    fireEvent.click(screen.getByRole('button', { name: /Acciones de Biology/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Restaurar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Libera un cupo de tus listas activas antes de restaurar.');
    expect(await screen.findByText('Biology')).toBeInTheDocument();
  });

  it('keeps search and collection controls localized in English', async () => {
    await i18n.changeLanguage('en');
    renderView([], {});
    expect(await screen.findByRole('searchbox', { name: 'Search lists' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    await i18n.changeLanguage('es');
  });

  it('does not render a list card returned with a different owner identity', async () => {
    renderView([populatedList, { ...emptyList, id: 'other-list', owner_id: 'user-b', name: 'Private other list' }], {});
    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(screen.queryByText('Private other list')).not.toBeInTheDocument();
  });

  it('retries duplicate with the same operation id after an uncertain failure', async () => {
    vi.mocked(duplicatePrivateList)
      .mockRejectedValueOnce(new DomainServiceError('unavailable', 'unavailable'))
      .mockResolvedValueOnce(populatedList);
    renderView([populatedList], {});
    await screen.findByText('Biology');
    fireEvent.click(screen.getByRole('button', { name: /Acciones de Biology/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicar' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(i18n.t('lists.name')), { target: { value: 'Biology copy' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('lists.submit') }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('lists.submit') }));
    await waitFor(() => expect(duplicatePrivateList).toHaveBeenCalledTimes(2));
    expect(vi.mocked(duplicatePrivateList).mock.calls[0][2]).toBe(vi.mocked(duplicatePrivateList).mock.calls[1][2]);
    expect(duplicatePrivateList).toHaveBeenLastCalledWith('full-list', 'Biology copy', expect.any(String));
  });

  it('keeps a duplicate-name rename open and shows localized feedback', async () => {
    vi.mocked(renamePrivateList).mockRejectedValue(new DomainServiceError('duplicate_name', 'duplicate_name'));
    renderView([populatedList], {});
    await screen.findByText('Biology');
    fireEvent.click(screen.getByRole('button', { name: /Acciones de Biology/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Renombrar' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText(i18n.t('lists.name')), { target: { value: 'Taken' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('lists.submit') }));
    expect((await screen.findAllByText(i18n.t('lists.duplicate'))).length).toBeGreaterThan(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows a read failure separately and recovers with the preserved collection', async () => {
    renderView([], {}, vi.fn(), true);
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('lists.unavailable'));
    expect(screen.queryByText(i18n.t('lists.empty'))).not.toBeInTheDocument();
    vi.mocked(getListCollectionPage).mockResolvedValue({ items: [populatedList], hasMore: false, nextCursor: null });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('lists.retry') }));
    expect(await screen.findByText('Biology')).toBeInTheDocument();
  });
});
