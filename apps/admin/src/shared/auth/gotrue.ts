// Cliente mínimo del API de GoTrue (supabase/gotrue). Solo lo que el panel
// necesita: contraseña, renovación de token y cierre de sesión.
import type { StoredSession } from './session';

const GOTRUE_BASE = (import.meta.env.VITE_GOTRUE_URL || 'http://127.0.0.1:9999').replace(/\/$/, '');

/** Error de autenticación con un mensaje ya listo para mostrar en español. */
export class AuthError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

interface GoTrueTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function toStoredSession(body: GoTrueTokenResponse): StoredSession {
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + body.expires_in * 1000,
  };
}

async function postToken(query: string, payload: Record<string, string>): Promise<StoredSession> {
  let response: Response;
  try {
    response = await fetch(`${GOTRUE_BASE}/token?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AuthError('No se pudo conectar con el servicio de autenticación.', 0);
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new AuthError('Correo o contraseña incorrectos.', response.status);
    }
    throw new AuthError('El servicio de autenticación no está disponible.', response.status);
  }

  return toStoredSession((await response.json()) as GoTrueTokenResponse);
}

/** Inicia sesión con correo y contraseña (grant_type=password). */
export function signInWithPassword(email: string, password: string): Promise<StoredSession> {
  return postToken('grant_type=password', { email, password });
}

/** Renueva el access token con el refresh token (grant_type=refresh_token). */
export function refreshSession(refreshToken: string): Promise<StoredSession> {
  return postToken('grant_type=refresh_token', { refresh_token: refreshToken });
}

/**
 * Invalida la sesión en GoTrue. Es best-effort: el panel borra la sesión local
 * aunque esta llamada falle.
 */
export async function signOutRemote(accessToken: string): Promise<void> {
  try {
    await fetch(`${GOTRUE_BASE}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Sin red: la sesión local se borra igualmente.
  }
}
