import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountView from './AccountView';
import i18n from '../../i18n/i18n';

const user = {
  email: 'person@example.com',
  user_metadata: { full_name: 'Alex Example' },
};

function renderAccount(props: Partial<ComponentProps<typeof AccountView>> = {}) {
  const onDelete = props.onDelete ?? vi.fn(async () => 'pending' as const);
  const onSignOut = props.onSignOut ?? vi.fn();
  const onBack = props.onBack ?? vi.fn();

  return {
    onBack,
    onDelete,
    onSignOut,
    ...render(
      <MantineProvider>
        <I18nextProvider i18n={i18n}>
          <AccountView
            user={user}
            deletionPending={false}
            onBack={onBack}
            onDelete={onDelete}
            onSignOut={onSignOut}
            {...props}
          />
        </I18nextProvider>
      </MantineProvider>,
    ),
  };
}

describe('AccountView', () => {
  beforeEach(() => {
    void i18n.changeLanguage('es');
  });

  it('does not request deletion when confirmation is cancelled', async () => {
    const { onDelete } = renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta de Chucao' }));
    const dialog = await screen.findByRole('dialog', { name: 'Eliminar cuenta de Chucao' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requires confirmation and offers retry while deletion remains pending', async () => {
    const { onDelete } = renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta de Chucao' }));
    const dialog = await screen.findByRole('dialog', { name: 'Eliminar cuenta de Chucao' });
    expect(within(dialog).getByText(/no elimina ni modifica tu cuenta de google/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar eliminación' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/sigue pendiente/i);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reintentar eliminación' })).toBeInTheDocument();
    expect(screen.queryByText(/cuenta eliminada/i)).not.toBeInTheDocument();
  });

  it('announces confirmed completion and keeps identity/provider scope clear', async () => {
    const onDelete = vi.fn(async () => 'completed' as const);
    renderAccount({ onDelete });
    expect(screen.getByText('Alex Example')).toBeInTheDocument();
    expect(screen.getByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByText(/no elimina ni modifica tu cuenta de google/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta de Chucao' }));
    const dialog = await screen.findByRole('dialog', { name: 'Eliminar cuenta de Chucao' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar eliminación' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/se eliminó tu cuenta de chucao/i);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('reports an unconfirmed result and lets the person retry', async () => {
    const onDelete = vi.fn()
      .mockRejectedValueOnce(new Error('uncertain'))
      .mockResolvedValueOnce('pending');
    renderAccount({ onDelete });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta de Chucao' }));
    const dialog = await screen.findByRole('dialog', { name: 'Eliminar cuenta de Chucao' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar eliminación' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se confirmó/i);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar eliminación' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/sigue pendiente/i);
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it('provides accessible account controls in English', async () => {
    await i18n.changeLanguage('en');
    renderAccount();

    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Chucao account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
