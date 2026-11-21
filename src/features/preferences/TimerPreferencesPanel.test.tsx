import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, ToastViewport } from '../../app/toasts/ToastProvider';
import i18n from '../../i18n/i18n';
import { TimerPreferencesPanel } from './TimerPreferencesPanel';
import {
  DEFAULT_TIMER_PREFERENCES,
  getTimerPreferences,
  setTimerPreference,
} from './preferencesService';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

vi.mock('./preferencesService', async (importOriginal) => {
  const original = await importOriginal<typeof import('./preferencesService')>();
  return {
    ...original,
    getTimerPreferences: vi.fn(),
    setTimerPreference: vi.fn(),
  };
});

const readPreferences = vi.mocked(getTimerPreferences);
const savePreference = vi.mocked(setTimerPreference);

afterEach(() => vi.unstubAllGlobals());

function renderPanel() {
  return render(
    <MantineProvider>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <TimerPreferencesPanel userId="user-a" />
          <ToastViewport />
        </ToastProvider>
      </I18nextProvider>
    </MantineProvider>,
  );
}

describe('TimerPreferencesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    void i18n.changeLanguage('es');
    readPreferences.mockResolvedValue({ ...DEFAULT_TIMER_PREFERENCES });
    savePreference.mockImplementation(async (_userId, key, value) => ({
      ...DEFAULT_TIMER_PREFERENCES,
      [key]: value,
    }));
  });

  it('keeps effective defaults available and offers retry when preference loading fails', async () => {
    readPreferences.mockRejectedValueOnce(new Error('private failure'));

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudieron cargar/i);
    expect(screen.getByRole('slider', { name: /volumen/i })).toHaveAttribute('aria-valuenow', '50');
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(readPreferences).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('heading', { name: /créditos y licencias/i })).not.toBeInTheDocument();
  });

  it('retains a selected value after a failed save and marks it saved only after retry succeeds', async () => {
    let failPendingSave: ((reason?: unknown) => void) | undefined;
    savePreference
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        failPendingSave = reject;
      }))
      .mockImplementationOnce(async (_userId, key, value) => ({
        ...DEFAULT_TIMER_PREFERENCES,
        [key]: value,
      }));

    renderPanel();

    const duration = await screen.findByRole('combobox', { name: /duración predeterminada/i });
    fireEvent.change(duration, { target: { value: '5' } });

    expect(await screen.findByText(/guardando/i)).toBeInTheDocument();
    failPendingSave?.(new Error('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo guardar/i);
    expect(duration).toHaveValue('5');

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => expect(savePreference).toHaveBeenCalledTimes(2));
    const toastRegion = screen.getByRole('region', { name: 'Notificaciones' });
    expect(await within(toastRegion).findByText(/Se guardó: Duración predeterminada/i)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Temporizador' })).queryByText(/^Guardado$/i)).not.toBeInTheDocument();
  });

  it('previews current volume without changing saved sound-enabled state', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const audioInstances: Array<{ volume: number }> = [];
    vi.stubGlobal('Audio', class {
      volume = 1;
      play = play;
      pause = pause;
      currentTime = 0;
      constructor() { audioInstances.push(this); }
    });

    renderPanel();

    const soundSwitch = await screen.findByRole('switch', { name: /sonido al finalizar/i });
    fireEvent.click(soundSwitch);
    await waitFor(() => expect(savePreference).toHaveBeenCalledWith('user-a', 'completionSoundEnabled', false));
    savePreference.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /probar sonido/i }));

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(audioInstances[0]?.volume).toBeCloseTo(10 ** (-30 / 20));
    expect(savePreference).not.toHaveBeenCalled();
  });

  it('preserves the local unsaved selection when the interface language changes', async () => {
    savePreference.mockRejectedValue(new Error('offline'));

    renderPanel();

    const duration = await screen.findByRole('combobox', { name: /duración predeterminada/i });
    fireEvent.change(duration, { target: { value: '7' } });
    expect(await screen.findByText(/no se pudo guardar/i)).toBeInTheDocument();

    await i18n.changeLanguage('en');

    expect(await screen.findByRole('combobox', { name: /default duration/i })).toHaveValue('7');
  });
});
