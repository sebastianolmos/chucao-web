import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/i18n';
import { PracticeView } from './PracticeView';

function renderPractice(props: Partial<React.ComponentProps<typeof PracticeView>> = {}) {
  return render(
    <MantineProvider>
      <I18nextProvider i18n={i18n}>
        <PracticeView
          initialDurationMinutes={1}
          reducedMotion={false}
          soundEnabled={false}
          soundVolume={50}
          onReturn={vi.fn()}
          {...props}
        />
      </I18nextProvider>
    </MantineProvider>,
  );
}

describe('PracticeView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    void i18n.changeLanguage('es');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows an editable prepared duration, rejects invalid input, and starts once valid', () => {
    renderPractice();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /01:00/i }));
    const duration = screen.getByRole('spinbutton', { name: /duraci.n/i });
    expect(duration).toHaveValue(1);

    fireEvent.change(duration, { target: { value: '60' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/1 y 59/i);
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    expect(screen.getByRole('status', { name: /preparado/i })).toHaveTextContent('Preparado');

    fireEvent.change(duration, { target: { value: '2' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    expect(screen.getByRole('status', { name: /en curso/i })).toHaveTextContent('En curso');
    expect(screen.getByLabelText(/tiempo restante/i)).toHaveTextContent('02:00');
  });

  it('keeps the forest call visible briefly after arrival, then hides it', () => {
    renderPractice();
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(60_000));
    const scene = screen.getByRole('img', { name: /escena del bosque/i });
    expect(scene).toHaveAttribute('data-singing', 'true');
    act(() => vi.advanceTimersByTime(1_500));
    expect(scene).toHaveAttribute('data-singing', 'false');
  });

  it('emits one save identity and the exact completion instant only when the timer completes', () => {
    const onCompleted = vi.fn();
    renderPractice({ onCompleted });
    expect(onCompleted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(60_000));

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      durationMinutes: 1,
      completedAt: '2026-01-01T12:01:00.000Z',
    }));
    act(() => vi.advanceTimersByTime(1_000));
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('keeps the completed associated scene visible until the person opens the closure', () => {
    const onContinueToClosure = vi.fn();
    renderPractice({
      concept: { title: 'Fotosíntesis', description: 'Proceso de las plantas' },
      onContinueToClosure,
    });
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(60_000));

    expect(screen.getByRole('img', { name: /escena del bosque/i })).toHaveAttribute('data-singing', 'true');
    expect(screen.getByRole('status', { name: /finalizada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar nota y calificaci[oó]n/i })).toBeInTheDocument();
    expect(onContinueToClosure).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /agregar nota y calificaci[oó]n/i }));
    expect(onContinueToClosure).toHaveBeenCalledTimes(1);
  });

  it('does not emit a saveable completion when the timer is abandoned before completion', () => {
    const onCompleted = vi.fn();
    renderPractice({ onCompleted });
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(59_000));
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('uses a fresh save identity after the user confirms a restart', () => {
    const onCompleted = vi.fn();
    renderPractice({ onCompleted });
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(60_000));
    const firstId = onCompleted.mock.calls[0][0].id;

    fireEvent.click(screen.getByRole('button', { name: /reiniciar/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /s[ií], reiniciar/i }));
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(60_000));

    expect(onCompleted).toHaveBeenCalledTimes(2);
    expect(onCompleted.mock.calls[1][0].id).not.toBe(firstId);
  });
  it('pauses, resumes, completes from elapsed wall time, then restarts only after confirmation', () => {
    renderPractice();
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByLabelText(/tiempo restante/i)).toHaveTextContent('00:55');

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }));
    expect(screen.getByRole('status', { name: /pausado/i })).toHaveTextContent('Pausado');
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByLabelText(/tiempo restante/i)).toHaveTextContent('00:55');
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    act(() => vi.advanceTimersByTime(55_000));
    expect(screen.getByRole('status', { name: /finalizada/i })).toHaveTextContent('Práctica finalizada');
    expect(screen.getByLabelText(/tiempo restante/i)).toHaveTextContent('00:00');

    fireEvent.click(screen.getByRole('button', { name: /reiniciar/i }));
    const dialog = screen.getByRole('dialog');
    const dialogTitle = within(dialog).getByRole('heading', { name: /reiniciar temporizador/i });
    expect(dialogTitle).toHaveStyle({ fontWeight: '800' });
    expect(dialogTitle.getAttribute('style')).toContain('color: var(--chucao-brown)');
    expect(dialog.querySelector('.mantine-Modal-header')?.getAttribute('style'))
      .toContain('background-color: var(--chucao-cream)');
    expect(dialog.querySelector('button[aria-label]')?.getAttribute('style'))
      .toContain('background-color: var(--chucao-cyan)');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }));
    expect(screen.getByRole('status', { name: /finalizada/i })).toHaveTextContent('Práctica finalizada');
    fireEvent.click(screen.getByRole('button', { name: /reiniciar/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /reiniciar/i }));
    expect(screen.getByRole('status', { name: /preparado/i })).toHaveTextContent('Preparado');
    expect(screen.getByRole('button', { name: /01:00/i })).toHaveTextContent('01:00');
  });

  it('holds the bird position and returns it to its resting frame when paused mid-flight', () => {
    renderPractice();
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(12_600));
    const scene = screen.getByRole('img', { name: /escena del bosque/i });
    expect(scene).toHaveAttribute('data-flying', 'true');
    expect(screen.getByTestId('forest-shadow')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pausar/i }));
    expect(scene).toHaveAttribute('data-flying', 'false');
    expect(screen.queryByTestId('forest-shadow')).not.toBeInTheDocument();
    const positionAtPause = scene.getAttribute('data-position-x');
    expect(scene).toHaveAttribute('data-position-x', positionAtPause);
    act(() => vi.advanceTimersByTime(2_000));
    expect(scene).toHaveAttribute('data-position-x', positionAtPause);
  });

  it('turns the bird toward the opposite side as each new support is reached', () => {
    renderPractice();
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => vi.advanceTimersByTime(16_500));
    const scene = screen.getByRole('img', { name: /escena del bosque/i });
    expect(scene).toHaveAttribute('data-support-index', '1');
    expect(scene).toHaveAttribute('data-facing', 'left');
  });

  it('reveals associated plain-text description without changing timer state', () => {
    renderPractice({ concept: { title: '<Bosque>', description: '<script>alert(1)</script> idea' } });
    expect(screen.getByRole('heading', { name: '<Bosque>', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('<script>alert(1)</script> idea')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mostrar descripci[oó]n/i }));
    expect(screen.getByText('<script>alert(1)</script> idea')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /preparado/i })).toHaveTextContent('Preparado');
    expect(screen.queryByRole('heading', { name: /concepto/i })).not.toBeInTheDocument();
  });

  it('keeps reduced-motion and independent scenes static and omits concept placeholders', () => {
    renderPractice({ reducedMotion: true });
    const scene = screen.getByRole('img', { name: /escena del bosque/i });
    expect(scene).toHaveAttribute('data-reduced-motion', 'true');
    expect(scene).toHaveAttribute('data-support-index', '4');
    expect(screen.queryByText(/descripci[oó]n del concepto/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /concepto/i })).not.toBeInTheDocument();
  });

  it('snapshots the system reduced-motion preference at entry when the account follows the system', () => {
    const systemMatchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...systemMatchMedia(query),
      matches: true,
    }));
    const view = renderPractice({ reducedMotion: null });
    expect(screen.getByRole('img', { name: /escena del bosque/i })).toHaveAttribute('data-reduced-motion', 'true');

    view.rerender(
      <MantineProvider>
        <I18nextProvider i18n={i18n}>
          <PracticeView
            initialDurationMinutes={1}
            reducedMotion={false}
            soundEnabled={true}
            soundVolume={100}
            onReturn={vi.fn()}
          />
        </I18nextProvider>
      </MantineProvider>,
    );
    expect(screen.getByRole('img', { name: /escena del bosque/i })).toHaveAttribute('data-reduced-motion', 'true');
  });

  it('lets an explicit full-motion account value override the system preference', () => {
    const systemMatchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...systemMatchMedia(query),
      matches: true,
    }));
    renderPractice({ reducedMotion: false });
    expect(screen.getByRole('img', { name: /escena del bosque/i })).toHaveAttribute('data-reduced-motion', 'false');
  });

  it('uses the entry sound snapshot once at completion and tolerates playback failure', () => {
    const play = vi.fn().mockRejectedValue(new Error('blocked'));
    const audios: Array<{ volume: number }> = [];
    vi.stubGlobal('Audio', class {
      volume = 1;
      play = play;
      constructor() { audios.push(this); }
    });
    const view = renderPractice({ soundEnabled: true, soundVolume: 50 });
    view.rerender(
      <MantineProvider>
        <I18nextProvider i18n={i18n}>
          <PracticeView
            initialDurationMinutes={1}
            reducedMotion={false}
            soundEnabled={false}
            soundVolume={100}
            onReturn={vi.fn()}
          />
        </I18nextProvider>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /comenzar/i }));
    act(() => {
      vi.setSystemTime(Date.now() + 60_000);
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByRole('status', { name: /finalizada/i })).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(1);
    expect(audios[0].volume).toBeCloseTo(10 ** (-30 / 20));
  });
});
