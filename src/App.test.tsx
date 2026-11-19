import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, ToastViewport } from './app/toasts/ToastProvider';
import App from './App';
import i18n from './i18n/i18n';

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  getTimerPreferences: vi.fn(),
  setTimerPreference: vi.fn(),
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
  setTimerPreference: mocks.setTimerPreference,
  DEFAULT_TIMER_PREFERENCES: {
    defaultDurationMinutes: 1,
    completionSoundEnabled: true,
    soundVolume: 50,
    reducedMotion: null,
  },
}));
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'user-1', email: 'person@example.com' } } },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));
vi.mock('./features/lists/MyListsView', () => ({
  MyListsView: () => <div>My Lists test fixture</div>,
}));
vi.mock('./features/lists/ListDetailView', () => ({
  ListDetailView: () => <div>List Detail test fixture</div>,
}));

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

describe('Preferences credits navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locale.locale = 'es';
    mocks.ensureProfile.mockResolvedValue({});
    mocks.getTimerPreferences.mockResolvedValue({
      defaultDurationMinutes: 1,
      completionSoundEnabled: true,
      soundVolume: 50,
      reducedMotion: null,
    });
    mocks.setTimerPreference.mockResolvedValue({});
    void i18n.changeLanguage('es');
  });

  it('opens a themed credits view beside Privacy and returns to Preferences', async () => {
    renderApp();

    fireEvent.click(await screen.findByRole('button', { name: /abrir preferencias/i }));
    const dialog = await screen.findByRole('dialog', { name: /preferencias/i });
    const duration = await within(dialog).findByRole('combobox', { name: /duración predeterminada/i });
    expect(duration.style.backgroundColor).toBe('var(--chucao-cream)');
    expect(dialog.outerHTML).toContain('var(--chucao-cream)');

    const actions = within(dialog);
    fireEvent.click(actions.getByRole('button', { name: 'Créditos y licencias' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Créditos y licencias' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /XC870902, xeno-canto/i })).toHaveAttribute('href', 'https://xeno-canto.org/870902');
    expect(screen.getByText(/reducción de ruido y recorte de fragmentos/i)).toBeInTheDocument();
    expect(screen.getByText(/excluidos de la licencia MIT/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    const returnedDialog = await screen.findByRole('dialog', { name: /preferencias/i });
    await waitFor(() => expect(within(returnedDialog).getByRole('button', { name: 'Privacidad' })).toBeInTheDocument());
    expect(within(returnedDialog).getByRole('button', { name: 'Créditos y licencias' })).toBeInTheDocument();

    fireEvent.click(within(returnedDialog).getByRole('button', { name: 'Privacidad' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacidad' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('dialog', { name: /preferencias/i })).toBeInTheDocument();
  });

  it('keeps sign out inside a scrollable preferences dialog', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /abrir preferencias/i }));
    const dialog = await screen.findByRole('dialog', { name: /preferencias/i });
    const signOut = within(dialog).getByRole('button', { name: i18n.t('auth.signOut') });
    const body = signOut.closest('.mantine-Modal-body');

    expect(body).not.toBeNull();
    expect((body as HTMLElement).style.overflowY).toBe('auto');
    expect((body as HTMLElement).style.maxHeight).toBe('calc(100dvh - 7rem)');
  });
});
