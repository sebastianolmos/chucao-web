import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, ToastViewport } from './app/toasts/ToastProvider';
import App from './App';
import i18n from './i18n/i18n';
import { queryClient } from './lib/queryClient';

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  getAccountDeletionStatus: vi.fn(),
  retryAccountDeletion: vi.fn(),
  authChangeCallback: null as ((event: string, session: { user: { id: string; email?: string } } | null) => void) | null,
  signOut: vi.fn(),
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
vi.mock('./features/account/accountService', () => ({
  getAccountDeletionStatus: mocks.getAccountDeletionStatus,
  retryAccountDeletion: mocks.retryAccountDeletion,
}));
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback: (event: string, session: { user: { id: string; email?: string } } | null) => void) => {
        mocks.authChangeCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'user-1', email: 'person@example.com' } } },
        error: null,
      })),
      signOut: mocks.signOut,
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
    mocks.getAccountDeletionStatus.mockResolvedValue('active');
    mocks.retryAccountDeletion.mockResolvedValue({ status: 'pending' });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.getTimerPreferences.mockResolvedValue({
      defaultDurationMinutes: 1,
      completionSoundEnabled: true,
      soundVolume: 50,
      reducedMotion: null,
    });
    mocks.setTimerPreference.mockResolvedValue({});
    void i18n.changeLanguage('es');
  });

  it('checks lifecycle status before initializing an active profile', async () => {
    const sequence: string[] = [];
    mocks.getAccountDeletionStatus.mockImplementation(async () => {
      sequence.push('status');
      return 'active';
    });
    mocks.ensureProfile.mockImplementation(async () => {
      sequence.push('profile');
      return {};
    });

    renderApp();

    expect(await screen.findByText('My Lists test fixture')).toBeInTheDocument();
    expect(sequence).toEqual(['status', 'profile']);
    expect(mocks.locale.syncAccountLocale).toHaveBeenCalledWith('user-1');
  });

  it('blocks private initialization for a pending account and keeps retry and sign-out available', async () => {
    mocks.getAccountDeletionStatus.mockResolvedValue('deletion_pending');

    renderApp();

    expect(await screen.findByRole('heading', { name: 'Eliminación de cuenta pendiente' })).toBeInTheDocument();
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(mocks.locale.syncAccountLocale).not.toHaveBeenCalled();
    expect(screen.queryByText('My Lists test fixture')).not.toBeInTheDocument();

    mocks.retryAccountDeletion.mockResolvedValue({ status: 'pending' });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar eliminación' }));
    await waitFor(() => expect(mocks.retryAccountDeletion).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Eliminación de cuenta pendiente' })).toBeInTheDocument();
  });

  it('clears private views when an auth event reports a pending account', async () => {
    renderApp();
    expect(await screen.findByText('My Lists test fixture')).toBeInTheDocument();
    queryClient.setQueryData(['lists', 'user-1'], [{ id: 'private-list' }]);

    mocks.getAccountDeletionStatus.mockResolvedValue('deletion_pending');
    mocks.authChangeCallback?.('TOKEN_REFRESHED', { user: { id: 'user-1', email: 'person@example.com' } });

    expect(await screen.findByRole('heading', { name: 'Eliminación de cuenta pendiente' })).toBeInTheDocument();
    expect(screen.queryByText('My Lists test fixture')).not.toBeInTheDocument();
    expect(mocks.ensureProfile).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['lists', 'user-1'])).toBeUndefined();
  });

  it('returns to Access and signs out locally after confirmed deletion retry', async () => {
    mocks.getAccountDeletionStatus.mockResolvedValue('deletion_pending');
    mocks.retryAccountDeletion.mockResolvedValue({ status: 'completed' });

    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar eliminación' }));

    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    const privacyLink = screen.getByRole('link', { name: 'Privacidad' });
    const termsLink = screen.getByRole('link', { name: 'Términos de uso' });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
    expect(termsLink).toHaveAttribute('href', '/terms');
    expect(privacyLink.nextElementSibling).toBe(termsLink);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.queryByRole('heading', { name: 'Eliminación de cuenta pendiente' })).not.toBeInTheDocument();
  });

  it('fails closed when deletion status cannot be checked', async () => {
    mocks.getAccountDeletionStatus.mockRejectedValue(new Error('unavailable'));

    renderApp();

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo comprobar el estado de eliminación/i);
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(mocks.locale.syncAccountLocale).not.toHaveBeenCalled();
    expect(screen.queryByText('My Lists test fixture')).not.toBeInTheDocument();
  });

  it('opens a themed credits view beside Privacy and returns to Preferences', async () => {
    renderApp();

    fireEvent.click(await screen.findByRole('button', { name: /abrir preferencias/i }));
    const dialog = await screen.findByRole('dialog', { name: /preferencias/i });
    const duration = await within(dialog).findByRole('combobox', { name: /duración predeterminada/i });
    expect(duration.style.backgroundColor).toBe('var(--chucao-cream)');
    expect(dialog.outerHTML).toContain('var(--chucao-cream)');

    const actions = within(dialog);
    const privacyLink = actions.getByRole('link', { name: 'Privacidad' });
    const termsLink = actions.getByRole('link', { name: 'Términos de uso' });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
    expect(privacyLink).toHaveAttribute('target', '_blank');
    expect(termsLink).toHaveAttribute('href', '/terms');
    expect(termsLink).toHaveAttribute('target', '_blank');
    expect(privacyLink.nextElementSibling).toBe(termsLink);
    fireEvent.click(actions.getByRole('button', { name: 'Créditos y licencias' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Créditos y licencias' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /XC870902, xeno-canto/i })).toHaveAttribute('href', 'https://xeno-canto.org/870902');
    expect(screen.getByText(/reducción de ruido y recorte de fragmentos/i)).toBeInTheDocument();
    expect(screen.getByText(/excluidos de la licencia MIT/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    const returnedDialog = await screen.findByRole('dialog', { name: /preferencias/i });
    expect(await within(returnedDialog).findByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacy');
    expect(within(returnedDialog).getByRole('button', { name: 'Créditos y licencias' })).toBeInTheDocument();
  });

  it('opens Account from Preferences and returns to the same dialog', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /abrir preferencias/i }));
    const dialog = await screen.findByRole('dialog', { name: /preferencias/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Cuenta' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Identidad de Google' })).getByText('person@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a preferencias' }));
    expect(await screen.findByRole('dialog', { name: /preferencias/i })).toBeInTheDocument();
  });

  it('confirms Chucao account deletion from Account and returns to Access', async () => {
    mocks.retryAccountDeletion.mockResolvedValue({ status: 'completed' });
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /abrir preferencias/i }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: /preferencias/i }))
      .getByRole('button', { name: 'Cuenta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar cuenta de Chucao' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Eliminar cuenta de Chucao' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Confirmar eliminación' }));

    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(mocks.retryAccountDeletion).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
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
