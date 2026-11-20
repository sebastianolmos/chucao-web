import { supabase } from '../../lib/supabase';

export type AccountDeletionStatus = 'active' | 'deletion_pending';
export type AccountDeletionRetryResult = { status: 'pending' | 'completed' };

export async function getAccountDeletionStatus(): Promise<AccountDeletionStatus> {
  const { data, error } = await supabase.rpc('get_account_deletion_status');
  if (error) throw error;
  if (data !== 'active' && data !== 'deletion_pending') {
    throw new Error('Account deletion status could not be confirmed.');
  }
  return data;
}

export async function retryAccountDeletion(): Promise<AccountDeletionRetryResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: {},
  });
  if (error) throw error;

  if (data?.state === 'completed') return { status: 'completed' };
  if (data?.state === 'deletion_pending' && data?.retryable === true) {
    return { status: 'pending' };
  }

  throw new Error('Account deletion outcome could not be confirmed.');
}
