import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, unwrap } from '../api/client';
import {
  clearSession,
  getAccessToken,
  markActivity,
  readPersisted,
  readSession,
  writeSession,
} from './session';
import { AuthError, refreshSession, signInWithPassword, signOutRemote } from './gotrue';
import type { Identidad } from './types';

export type { Identidad } from './types';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  identidad: Identidad | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Renovar el access token este tiempo antes de que expire. */
const REFRESH_MARGIN_MS = 60_000;
/** Cerrar sesión tras este tiempo sin actividad del usuario (también entre recargas). */
const IDLE_TIMEOUT_MS = 15 * 60_000;
const IDLE_CHECK_MS = 30_000;
/** Escribir la actividad en almacenamiento como mucho cada este tiempo. */
const ACTIVITY_PERSIST_MS = 30_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
const PERSIST_KEY = 'trio_admin_refresh';
const ME_QUERY_KEY = ['auth', 'me'] as const;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const fetchMe = async (): Promise<Identidad> => {
  const me = await unwrap(api.GET('/api/v1/me'));
  return me as Identidad;
};

/** Cierra en GoTrue una sesión persistida que ya no se usará (inactiva al recargar). */
async function revokeStoredRefresh(refreshToken: string): Promise<void> {
  try {
    const fresh = await refreshSession(refreshToken);
    await signOutRemote(fresh.access_token);
  } catch {
    // Si GoTrue no responde, el refresh token caduca por su propio TTL.
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  // 'checking': restaurando la sesión persistida. 'present': hay tokens en memoria.
  // 'absent': no hay sesión.
  const [sessionState, setSessionState] = useState<'checking' | 'present' | 'absent'>('checking');
  // Se incrementa cuando cambia la sesión, para reprogramar la renovación.
  const [sessionVersion, setSessionVersion] = useState(0);
  const lastActivity = useRef(Date.now());
  const lastPersistedActivity = useRef(0);

  const identityQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    enabled: sessionState === 'present',
    retry: false,
    staleTime: 5 * 60_000,
  });

  const becomeAnonymous = useCallback(() => {
    clearSession();
    setSessionState('absent');
    queryClient.removeQueries({ queryKey: ['auth'] });
  }, [queryClient]);

  const recordActivity = useCallback((at: number) => {
    lastActivity.current = at;
    if (at - lastPersistedActivity.current >= ACTIVITY_PERSIST_MS) {
      lastPersistedActivity.current = at;
      markActivity(at);
    }
  }, []);

  // Restauración de la sesión persistida al cargar la página.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const persisted = readPersisted();
      if (!persisted) {
        setSessionState('absent');
        return;
      }
      if (Date.now() - persisted.last_activity >= IDLE_TIMEOUT_MS) {
        clearSession();
        await revokeStoredRefresh(persisted.refresh_token);
        if (!cancelled) setSessionState('absent');
        return;
      }
      try {
        writeSession(await refreshSession(persisted.refresh_token));
        markActivity();
        lastActivity.current = Date.now();
        lastPersistedActivity.current = Date.now();
        if (!cancelled) setSessionState('present');
      } catch (err) {
        if (cancelled) return;
        // Solo se descarta si GoTrue rechaza la sesión. Sin red se conserva
        // para reintentar al recargar.
        if (err instanceof AuthError && err.status !== 0) {
          becomeAnonymous();
        } else {
          setSessionState('absent');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [becomeAnonymous]);

  // La API rechazó el token de la sesión: se cierra.
  useEffect(() => {
    if (identityQuery.error instanceof ApiError && identityQuery.error.statusCode === 401) {
      becomeAnonymous();
    }
  }, [identityQuery.error, becomeAnonymous]);

  // Renovación proactiva. Usa siempre el refresh token más reciente del
  // almacenamiento: otra pestaña pudo rotarlo.
  useEffect(() => {
    if (sessionState !== 'present') return;
    const session = readSession();
    if (!session) return;

    const delay = Math.max(session.expires_at - Date.now() - REFRESH_MARGIN_MS, 0);
    const timer = window.setTimeout(() => {
      const refreshToken = readPersisted()?.refresh_token ?? session.refresh_token;
      refreshSession(refreshToken)
        .then((next) => {
          writeSession(next);
          setSessionVersion((v) => v + 1);
        })
        .catch((err: unknown) => {
          // Sin red (status 0) se conserva la sesión; un rechazo la cierra.
          if (err instanceof AuthError && err.status !== 0) becomeAnonymous();
        });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [sessionState, sessionVersion, becomeAnonymous]);

  const signOut = useCallback(async () => {
    const token = getAccessToken();
    becomeAnonymous();
    if (token) await signOutRemote(token);
  }, [becomeAnonymous]);

  // Cierre por inactividad. La actividad de otra pestaña también cuenta.
  useEffect(() => {
    if (sessionState !== 'present') return;

    const onActivity = () => recordActivity(Date.now());
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      const persistedActivity = readPersisted()?.last_activity ?? 0;
      const last = Math.max(lastActivity.current, persistedActivity);
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        void signOut();
      }
    }, IDLE_CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.clearInterval(interval);
    };
  }, [sessionState, recordActivity, signOut]);

  // Otras pestañas: si cierran sesión (se borra la clave), esta también se cierra.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PERSIST_KEY && event.newValue === null) {
        becomeAnonymous();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [becomeAnonymous]);

  // El cliente HTTP emite este evento ante un 401 de la API.
  useEffect(() => {
    const onUnauthorized = () => becomeAnonymous();
    window.addEventListener('blakor:unauthorized', onUnauthorized);
    return () => window.removeEventListener('blakor:unauthorized', onUnauthorized);
  }, [becomeAnonymous]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await signInWithPassword(email, password);
      writeSession(session);
      markActivity();
      lastActivity.current = Date.now();
      lastPersistedActivity.current = Date.now();
      try {
        await queryClient.fetchQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe, staleTime: 0 });
      } catch (err) {
        becomeAnonymous();
        if (err instanceof ApiError && err.statusCode === 401) {
          throw new AuthError('Tu sesión no fue aceptada por la API. Inténtalo de nuevo.', 401);
        }
        throw new AuthError('No se pudo cargar tu cuenta. Revisa que la API esté disponible.', 0);
      }
      setSessionState('present');
      setSessionVersion((v) => v + 1);
    },
    [becomeAnonymous, queryClient]
  );

  const status: AuthStatus = useMemo(() => {
    if (sessionState === 'checking') return 'loading';
    if (sessionState === 'absent') return 'anonymous';
    if (identityQuery.isSuccess) return 'authenticated';
    if (identityQuery.isError) return 'anonymous';
    return 'loading';
  }, [sessionState, identityQuery.isSuccess, identityQuery.isError]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identidad: status === 'authenticated' ? (identityQuery.data ?? null) : null,
      signIn,
      signOut,
    }),
    [status, identityQuery.data, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
