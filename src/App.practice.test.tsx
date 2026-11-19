import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { ActiveConceptRow, ListRow } from './lib/database.types';
import { ToastProvider, ToastViewport } from './app/toasts/ToastProvider';
import App from './App';
import i18n from './i18n/i18n';

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  getTimerPreferences: vi.fn(),
  getOwnedLists: vi.fn(),
  getOwnedConcepts: vi.fn(),
  saveCompletedPractice: vi.fn(),
  loadCurrentRound: vi.fn(),
  authChangeCallback: null as ((event: string, session: Session | null) => void) | null,
  locale: {
    locale: 'es' as 'es' | 'en',
    preferenceSyncStatus: 'idle',
    selectLocale: vi.fn(),
    syncAccountLocale: vi.fn(),
    clearAccountLocale: vi.fn(),
    retryAccountLocale: vi.fn(),
  },
}));

vi.mock('./app/localeContext', () => ({ useLocale: () => mocks.locale }));
vi.mock('./features/preferences/preferencesService', () => ({
  ensureProfile: mocks.ensureProfile,
  getTimerPreferences: mocks.getTimerPreferences,
  DEFAULT_TIMER_PREFERENCES: {
    defaultDurationMinutes: 1,
    completionSoundEnabled: false,
    soundVolume: 50,
    reducedMotion: null,
  },
}));
vi.mock('./features/lists/listService', () => ({
  getOwnedLists: mocks.getOwnedLists,
  listQueryKey: (userId: string) => ['lists', userId],
}));
vi.mock('./features/concepts/conceptService', () => ({
  getOwnedConcepts: mocks.getOwnedConcepts,
}));
vi.mock('./features/practice/practiceService', () => ({
  saveCompletedPractice: mocks.saveCompletedPractice,
}));
vi.mock('./features/rounds/roundService', () => ({
  loadCurrentRound: mocks.loadCurrentRound,
}));
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        mocks.authChangeCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'user-a', email: 'person@example.com' } } },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));
vi.mock('./features/lists/MyListsView', () => ({
  MyListsView: ({
    onOpenList,
    onStartIndependentTimer,
  }: {
    onOpenList: (list: ListRow) => void;
    onStartIndependentTimer: () => void;
  }) => (
    <div>
      <p>My Lists test fixture</p>
      <button onClick={onStartIndependentTimer} type="button">Independent Timer fixture</button>
      <button onClick={() => onOpenList({
        id: 'list-a', owner_id: 'user-a', name: 'Biología', name_normalized: 'biología',
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        archived_at: null,
      })} type="button">Open List fixture</button>
    </div>
  ),
}));
vi.mock('./features/lists/ListDetailView', () => ({
  ListDetailView: ({
    onStartPractice,
    pendingRoundAction,
  }: {
    onStartPractice: (conceptId: string) => void;
    pendingRoundAction?: { id: number; listId: string; action: 'draw' | 'new_round' } | null;
  }) => (
    <div>
      <p>List Detail test fixture</p>
      <button onClick={() => onStartPractice('concept-a')} type="button">Associated Practice fixture</button>
      {pendingRoundAction && <p data-testid="post-save-round-action">{pendingRoundAction.action}</p>}
    </div>
  ),
}));

const list = {
  id: 'list-a', owner_id: 'user-a', name: 'Biología', name_normalized: 'biología',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
} as ListRow;
const concept = {
  id: 'concept-a', list_id: list.id, title: 'Fotosíntesis', description: 'Proceso de las plantas',
  state: 'seen', position: 0, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', deleted_at: null,
} as ActiveConceptRow;

function renderApp() {
  return render(
    <MantineProvider>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <App />
          <ToastViewport />
        </ToastProvider>
      </I18nextProvider>
    </MantineProvider>,
  );
}

describe('VIEW-07 application journeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locale.locale = 'es';
    mocks.ensureProfile.mockResolvedValue({});
    mocks.getTimerPreferences.mockResolvedValue({
      defaultDurationMinutes: 1,
      completionSoundEnabled: false,
      soundVolume: 50,
      reducedMotion: null,
    });
    mocks.getOwnedLists.mockResolvedValue([list]);
    mocks.getOwnedConcepts.mockResolvedValue([concept]);
    mocks.loadCurrentRound.mockResolvedValue({ id: 'round-a', list_id: list.id, status: 'open', opened_at: '2026-01-01T00:00:00Z' });
    mocks.saveCompletedPractice.mockResolvedValue({ status: 'confirmed', practice: { id: 'practice-saved', owner_id: 'user-a' }, note: null, replayed: false });
    void i18n.changeLanguage('es');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the independent timer and stays or confirms abandonment from active navigation', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Independent Timer fixture' }));
    expect(await screen.findByRole('heading', { name: 'Práctica independiente' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fotosíntesis' })).not.toBeInTheDocument();
    expect(mocks.getTimerPreferences).toHaveBeenCalledWith('user-a');
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(screen.getByRole('heading', { name: 'Independent practice' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Prepared' })).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage('es'); });

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Mis listas' }));
    let dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/temporizador sigue en curso/i);
    const remainingTime = screen.getByLabelText('Tiempo restante');
    expect(remainingTime).toHaveTextContent('01:00');
    act(() => vi.advanceTimersByTime(2_000));
    expect(remainingTime).toHaveTextContent('00:58');
    fireEvent.click(screen.getByRole('button', { name: 'Seguir practicando' }));
    expect(screen.getByRole('heading', { name: 'Práctica independiente' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Mis listas' }));
    dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/temporizador sigue en curso/i);
    fireEvent.click(screen.getByRole('button', { name: 'Abandonar y volver' }));
    expect(screen.getByText('My Lists test fixture')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Práctica independiente' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Independent Timer fixture' }));
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: 'Práctica independiente' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Preparado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Mis listas' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('My Lists test fixture')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Independent Timer fixture' }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    act(() => {
      vi.setSystemTime(Date.now() + 60_000);
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('status', { name: 'Práctica finalizada' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText('My Lists test fixture')).toBeInTheDocument();
  });

  it('returns from the timer to the mode-specific view and confirms active abandonment', async () => {
    renderApp();
    await act(async () => { await i18n.changeLanguage('es'); });
    fireEvent.click(await screen.findByRole('button', { name: 'Independent Timer fixture' }));
    fireEvent.click(await screen.findByRole('button', { name: /volver a mis listas/i }));
    expect(screen.getByText('My Lists test fixture')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open List fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associated Practice fixture' }));
    expect(await screen.findByRole('button', { name: /volver a la lista/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    fireEvent.click(screen.getByRole('button', { name: /volver a la lista/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/temporizador sigue en curso/i);
    fireEvent.click(screen.getByRole('button', { name: 'Abandonar y volver' }));
    expect(screen.getByText('List Detail test fixture')).toBeInTheDocument();
  });

  it('revalidates associated context and returns to List Detail after completion', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Open List fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associated Practice fixture' }));

    expect(await screen.findByRole('heading', { name: 'Fotosíntesis' })).toBeInTheDocument();
    expect(screen.queryByText('Proceso de las plantas')).not.toBeInTheDocument();
    expect(mocks.getOwnedLists).toHaveBeenCalledWith('user-a');
    expect(mocks.getOwnedConcepts).toHaveBeenCalledWith('user-a', list.id);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar descripción' }));
    expect(screen.getByText('Proceso de las plantas')).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    act(() => {
      vi.setSystemTime(Date.now() + 60_000);
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('img', { name: /escena del bosque/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar nota y calificación/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cierre de práctica' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /agregar nota y calificación/i }));
    expect(screen.getByRole('heading', { name: 'Cierre de práctica' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText('List Detail test fixture')).toBeInTheDocument();
  });

  it('saves an independent closure only with a label and repeats with a fresh timer identity', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Independent Timer fixture' }));
    expect(await screen.findByRole('heading', { name: 'Práctica independiente' })).toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('button', { name: /agregar nota y calificaci[oó]n/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /agregar nota y calificaci[oó]n/i }));

    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/tema/i);
    expect(mocks.saveCompletedPractice).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: /tema/i }), { target: { value: 'Charla de prueba' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
      await Promise.resolve();
    });
    expect(screen.getByText(/guardada/i)).toBeInTheDocument();
    expect(mocks.saveCompletedPractice).toHaveBeenCalledTimes(1);
    const firstSave = mocks.saveCompletedPractice.mock.calls[0][0];
    expect(firstSave).toMatchObject({ kind: 'independent', label: 'Charla de prueba', rating: null, note: '' });

    fireEvent.click(screen.getByRole('button', { name: /practicar de nuevo/i }));
    expect(screen.getByRole('heading', { name: 'Práctica independiente' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Preparado' })).toBeInTheDocument();
    expect(mocks.saveCompletedPractice).toHaveBeenCalledTimes(1);
    expect(mocks.getTimerPreferences).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole('button', { name: /agregar nota y calificaci[oó]n/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /tema/i }), { target: { value: 'Segunda práctica' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
      await Promise.resolve();
    });
    expect(mocks.saveCompletedPractice).toHaveBeenCalledTimes(2);
    expect(mocks.saveCompletedPractice.mock.calls[1][0].id).not.toBe(firstSave.id);
  });

  it('refreshes associated round availability after save and sends the chosen new-round action to List Detail', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Open List fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associated Practice fixture' }));
    expect(await screen.findByRole('heading', { name: /Fotos/i })).toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole('button', { name: /agregar nota y calificaci[oó]n/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /iniciar nueva ronda/i })).toBeInTheDocument();
    expect(mocks.loadCurrentRound).toHaveBeenCalledWith(list.id);
    expect(mocks.saveCompletedPractice).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /iniciar nueva ronda/i }));
    expect(screen.getByTestId('post-save-round-action')).toHaveTextContent('new_round');
    expect(mocks.saveCompletedPractice).toHaveBeenCalledTimes(1);
  });

  it('hides Repeat when a saved associated concept is no longer active', async () => {
    mocks.getOwnedConcepts.mockResolvedValueOnce([concept]).mockResolvedValueOnce([]);
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Open List fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associated Practice fixture' }));
    expect(await screen.findByRole('heading', { name: /Fotos/i })).toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole('button', { name: /agregar nota y calificaci[oó]n/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
      await Promise.resolve();
    });

    expect(screen.getByText(/guardada/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /practicar este concepto de nuevo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sortear otro concepto|iniciar nueva ronda/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('does not start with a stale or unavailable associated concept', async () => {
    mocks.getOwnedConcepts.mockResolvedValueOnce([]);
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Open List fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associated Practice fixture' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya no está disponible/i);
    expect(screen.queryByRole('heading', { name: 'Fotosíntesis' })).not.toBeInTheDocument();
    expect(screen.getByText('List Detail test fixture')).toBeInTheDocument();
  });

  it('rejects an associated entry when its list is no longer owned', async () => {
    mocks.getOwnedLists.mockResolvedValueOnce([]);
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Open List fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associated Practice fixture' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya no está disponible/i);
    expect(mocks.getOwnedConcepts).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Fotosíntesis' })).not.toBeInTheDocument();
  });

  it('discards the in-memory timer when the authenticated session ends', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Independent Timer fixture' }));
    expect(await screen.findByRole('heading', { name: 'Práctica independiente' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    expect(screen.getByRole('status', { name: 'En curso' })).toBeInTheDocument();

    act(() => mocks.authChangeCallback?.('SIGNED_OUT', null));
    expect(await screen.findByRole('heading', { name: 'Chucao Web' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Práctica independiente' })).not.toBeInTheDocument();
  });

  it('clears the timer and private context when the authenticated account changes', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Open List fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associated Practice fixture' }));
    expect(await screen.findByRole('heading', { name: 'Fotosíntesis' })).toBeInTheDocument();

    await act(async () => {
      mocks.authChangeCallback?.('SIGNED_IN', {
        user: { id: 'user-b', email: 'other@example.com' },
      } as Session);
      await Promise.resolve();
    });

    expect(await screen.findByText('My Lists test fixture')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fotosíntesis' })).not.toBeInTheDocument();
  });
});
