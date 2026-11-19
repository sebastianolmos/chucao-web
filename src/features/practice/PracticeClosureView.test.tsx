import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/i18n';
import { PracticeClosureView } from './PracticeClosureView';

const { saveCompletedPractice } = vi.hoisted(() => ({ saveCompletedPractice: vi.fn() }));
vi.mock('./practiceService', () => ({ saveCompletedPractice }));

const completion = {
  id: '10000000-0000-4000-8000-000000000001',
  durationMinutes: 1,
  completedAt: '2026-01-01T12:01:00.000Z',
};
const context = {
  ownerId: 'owner-1',
  kind: 'associated' as const,
  listId: '20000000-0000-4000-8000-000000000002',
  conceptId: '30000000-0000-4000-8000-000000000003',
  roundId: null,
  appearanceId: null,
  conceptTitle: 'Anatomía',
};

function renderClosure() {
  const onReturn = vi.fn();
  render(
    <MantineProvider>
      <I18nextProvider i18n={i18n}>
        <PracticeClosureView completion={completion} context={context} onReturn={onReturn} onSaveLockChange={vi.fn()} />
      </I18nextProvider>
    </MantineProvider>,
  );
  return onReturn;
}

function renderIndependentClosure() {
  const onReturn = vi.fn();
  const onRepeat = vi.fn();
  render(
    <MantineProvider>
      <I18nextProvider i18n={i18n}>
        <PracticeClosureView {...({
          completion,
          context: { ownerId: 'owner-1', kind: 'independent', listId: null, conceptId: null, roundId: null, appearanceId: null },
          onReturn,
          onRepeat,
          onSaveLockChange: vi.fn(),
          postSaveActions: { status: 'ready', repeatAvailable: true, roundAction: null },
        } as unknown as React.ComponentProps<typeof PracticeClosureView>)} />
      </I18nextProvider>
    </MantineProvider>,
  );
  return { onReturn, onRepeat };
}

describe('PracticeClosureView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    void i18n.changeLanguage('es');
  });

  it('does not persist while opening or editing, then explicitly saves once and stays in closure', async () => {
    let resolveSave!: (value: { status: 'confirmed'; practice: { id: string }; note: string }) => void;
    saveCompletedPractice.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const onReturn = renderClosure();

    fireEvent.change(screen.getByRole('textbox', { name: /nota/i }), { target: { value: 'Mi nota' } });
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(saveCompletedPractice).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardando/i }));
    expect(saveCompletedPractice).toHaveBeenCalledTimes(1);
    expect(saveCompletedPractice).toHaveBeenCalledWith(expect.objectContaining({
      id: completion.id,
      kind: 'associated',
      listId: context.listId,
      conceptId: context.conceptId,
      durationMinutes: 1,
      completedAt: completion.completedAt,
      note: 'Mi nota',
      rating: 0,
    }));
    resolveSave({ status: 'confirmed', practice: { id: completion.id }, note: 'Mi nota' });
    expect(await screen.findByText(/guardada/i)).toBeInTheDocument();
    expect(onReturn).not.toHaveBeenCalled();
    expect(saveCompletedPractice).toHaveBeenCalledTimes(1);
  });

  it('retains note and rating after a rejected save so the user can correct and retry', async () => {
    saveCompletedPractice
      .mockResolvedValueOnce({ status: 'rejected', error: new Error('rejected') })
      .mockResolvedValueOnce({ status: 'confirmed', practice: { id: completion.id }, note: 'Nota corregida' });
    renderClosure();
    fireEvent.change(screen.getByRole('textbox', { name: /nota/i }), { target: { value: 'Nota corregida' } });
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: /nota/i })).toHaveValue('Nota corregida');
    expect(screen.getByRole('button', { name: '0' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    await screen.findByText(/guardada/i);
    expect(saveCompletedPractice).toHaveBeenCalledTimes(2);
  });

  it('locks an uncertain payload and retries it with the same identity and values', async () => {
    saveCompletedPractice
      .mockResolvedValueOnce({ status: 'unresolved', id: completion.id, error: new Error('uncertain') })
      .mockResolvedValueOnce({ status: 'confirmed', practice: { id: completion.id }, note: 'Nota' });
    renderClosure();
    fireEvent.change(screen.getByRole('textbox', { name: /nota/i }), { target: { value: 'Nota' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: /nota/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await screen.findByText(/guardada/i);
    expect(saveCompletedPractice).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: completion.id, note: 'Nota' }));
  });

  it('rejects a note over 2,000 Unicode code points before calling the save service', async () => {
    renderClosure();
    fireEvent.change(screen.getByRole('textbox', { name: /nota/i }), { target: { value: '🪶'.repeat(2001) } });
    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/2.000|2,000/i);
    expect(saveCompletedPractice).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /nota/i })).toHaveValue('🪶'.repeat(2001));
  });

  it('requires an independent label and saves it with optional note and Unrated rating only after Save', async () => {
    saveCompletedPractice.mockResolvedValue({ status: 'confirmed', practice: { id: completion.id }, note: null });
    const { onReturn, onRepeat } = renderIndependentClosure();
    expect(screen.getByRole('textbox', { name: /tema/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/tema/i);
    expect(saveCompletedPractice).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: /tema/i }), { target: { value: '  Charla libre  ' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    await screen.findByText(/guardada/i);
    expect(saveCompletedPractice).toHaveBeenCalledWith(expect.objectContaining({
      id: completion.id,
      kind: 'independent',
      listId: null,
      conceptId: null,
      roundId: null,
      appearanceId: null,
      label: '  Charla libre  ',
      note: '',
      rating: null,
    }));
    expect(onReturn).not.toHaveBeenCalled();
    expect(onRepeat).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /practicar de nuevo/i }));
    expect(onRepeat).toHaveBeenCalledTimes(1);
  });

  it('offers associated round actions only after confirmed save and activates the selected action', async () => {
    saveCompletedPractice.mockResolvedValue({ status: 'confirmed', practice: { id: completion.id }, note: null });
    const onDrawAnother = vi.fn();
    render(
      <MantineProvider>
        <I18nextProvider i18n={i18n}>
          <PracticeClosureView {...({
            completion,
            context: { ...context, kind: 'associated' },
            onReturn: vi.fn(),
            onSaveLockChange: vi.fn(),
            onRoundAction: onDrawAnother,
            postSaveActions: { status: 'ready', repeatAvailable: true, roundAction: 'draw' },
          } as unknown as React.ComponentProps<typeof PracticeClosureView>)} />
        </I18nextProvider>
      </MantineProvider>,
    );
    expect(screen.queryByRole('button', { name: /sortear otro/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /guardar pr[aá]ctica/i }));
    await screen.findByText(/guardada/i);
    expect(screen.getByRole('button', { name: /sortear otro/i })).toBeInTheDocument();
    expect(onDrawAnother).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /sortear otro/i }));
    expect(onDrawAnother).toHaveBeenCalledTimes(1);
    expect(saveCompletedPractice).toHaveBeenCalledTimes(1);
  });
});
