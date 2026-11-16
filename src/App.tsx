import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

function readOAuthError() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.has('error') || fragment.has('error')
    ? 'No se completó el acceso con Google. Intenta de nuevo.'
    : null;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(readOAuthError);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setBusy(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });

      if (error) throw error;
    } catch {
      setMessage('No se pudo iniciar el acceso con Google. Intenta de nuevo.');
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      setMessage('No se pudo cerrar la sesión. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (session === undefined) {
    return <p role="status">Comprobando sesión…</p>;
  }

  return (
    <main>
      <h1>{session ? 'Mis listas' : 'Chucao Web'}</h1>
      {message && <p role="alert">{message}</p>}

      {session ? (
        <>
          <p>Sesión iniciada como {session.user.email}</p>
          <button disabled={busy} onClick={signOut}>Cerrar sesión</button>
        </>
      ) : (
        <button disabled={busy} onClick={signIn}>Continuar con Google</button>
      )}
    </main>
  );
}