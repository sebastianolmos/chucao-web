import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListRow } from '../../lib/database.types';
import i18n from '../../i18n/i18n';
import { MyListsView } from './MyListsView';
import { getOwnedConceptCounts, getOwnedLists } from './listService';

vi.mock('./listService', () => ({
  getOwnedLists: vi.fn(),
  getOwnedConceptCounts: vi.fn(),
  listQueryKey: (userId: string) => ['lists', userId],
  createPrivateList: vi.fn(),
}));

const emptyList = { id: 'empty-list', name: 'Vacía' } as ListRow;
const populatedList = { id: 'full-list', name: 'Biología' } as ListRow;

function renderView(lists: ListRow[], counts: Record<string, number>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(getOwnedLists).mockResolvedValue(lists);
  vi.mocked(getOwnedConceptCounts).mockResolvedValue(counts);
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider><MyListsView userId="user-a" onOpenList={vi.fn()} /></MantineProvider>
    </QueryClientProvider>,
  );
}

describe('MyListsView concept progress', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('shows an empty label only for lists without active concepts', async () => {
    renderView([emptyList, populatedList], { [emptyList.id]: 0, [populatedList.id]: 4 });

    expect(await screen.findByRole('button', { name: /Vacía/ })).toHaveTextContent('Lista vacía');
    expect((await screen.findByRole('button', { name: /Biología/ })).textContent).toBe('BiologíaConceptos practicados 0/4');
    expect(screen.getByRole('button', { name: /Biología/ })).not.toHaveTextContent('Lista vacía');
  });
});
