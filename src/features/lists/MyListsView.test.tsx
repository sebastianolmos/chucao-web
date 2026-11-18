import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListRow } from '../../lib/database.types';
import i18n from '../../i18n/i18n';
import { ToastProvider } from '../../app/toasts/ToastProvider';
import { MyListsView } from './MyListsView';
import { getOwnedConceptCounts, getOwnedLists } from './listService';

vi.mock('./listService', () => ({
  getOwnedLists: vi.fn(),
  getOwnedConceptCounts: vi.fn(),
  listQueryKey: (userId: string) => ['lists', userId],
  createPrivateList: vi.fn(),
}));

const emptyList = { id: 'empty-list', name: 'Empty list' } as ListRow;
const populatedList = { id: 'full-list', name: 'Biology' } as ListRow;

function renderView(
  lists: ListRow[],
  counts: Record<string, { practiced: number; total: number }>,
  onStartIndependentTimer = vi.fn(),
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(getOwnedLists).mockResolvedValue(lists);
  vi.mocked(getOwnedConceptCounts).mockResolvedValue(counts);
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MantineProvider>
          <MyListsView userId="user-a" onOpenList={vi.fn()} onStartIndependentTimer={onStartIndependentTimer} />
        </MantineProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('MyListsView concept progress', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('shows total active concepts and zero progress for an empty list', async () => {
    renderView([emptyList, populatedList], {
      [emptyList.id]: { practiced: 0, total: 0 },
      [populatedList.id]: { practiced: 0, total: 4 },
    });

    expect(await screen.findByRole('button', { name: /Empty list/ }))
      .toHaveTextContent('Conceptos practicados 0/0');
    expect(await screen.findByRole('button', { name: /Biology/ }))
      .toHaveTextContent('Conceptos practicados 0/4');
  });

  it('shows practiced concepts in the list card progress', async () => {
    renderView([populatedList], {
      [populatedList.id]: { practiced: 2, total: 4 },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Biology/ }))
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
});
