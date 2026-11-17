import type { Locale, ProfileRow } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import {
  mapSupabaseError,
  unauthorizedError,
} from '../shared/supabaseErrors';

export const profileQueryKey = (userId: string) => ['profile', userId] as const;

async function assertCurrentUser(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw mapSupabaseError(error);
  }

  if (!data.user) {
    throw mapSupabaseError({ code: '28000', message: 'unauthenticated' });
  }

  if (data.user.id !== userId) {
    throw unauthorizedError();
  }
}

export async function ensureProfile(): Promise<ProfileRow> {
  const { data, error } = await supabase.rpc('ensure_profile');

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, locale, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}

export async function getLocale(userId: string): Promise<Locale | null> {
  const profile = await getProfile(userId);
  return profile?.locale ?? null;
}

export async function setLocale(
  userId: string,
  locale: Locale,
): Promise<ProfileRow> {
  await assertCurrentUser(userId);

  const { data, error } = await supabase
    .from('profiles')
    .update({ locale })
    .eq('id', userId)
    .select('id, locale, created_at, updated_at')
    .single();

  if (error) {
    throw mapSupabaseError(error);
  }

  return data;
}
