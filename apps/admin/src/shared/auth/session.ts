// Sesión de GoTrue. Diseño de menor exposición posible para una SPA:
// - El access token (vida corta) vive solo en memoria.
// - Solo el refresh token se persiste en localStorage, junto con la última
//   actividad del usuario (para la regla de inactividad entre recargas).
// Esto no es tan seguro como una cookie httpOnly emitida por un backend; un XSS
// podría leer el refresh token. Las mitigaciones son: CSP estricta en el
// despliegue, rotación del refresh token en cada renovación y cierre por inactividad.

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  /** Instante de expiración del access token, en milisegundos desde epoch. */
  expires_at: number;
}

interface PersistedSession {
  refresh_token: string;
  /** Última actividad del usuario, en milisegundos desde epoch. */
  last_activity: number;
}

const PERSIST_KEY = 'trio_admin_refresh';
/** Claves de versiones anteriores que guardaban tokens; se eliminan al cargar. */
const LEGACY_KEYS = ['trio_admin_session', 'blakor_auth_token'];

let current: StoredSession | null = null;

try {
  LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
} catch {
  // Sin acceso a localStorage no hay nada que limpiar.
}

function isPersisted(value: unknown): value is PersistedSession {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.refresh_token === 'string' && typeof p.last_activity === 'number';
}

/** Sesión en memoria (access token incluido). */
export function readSession(): StoredSession | null {
  return current;
}

/** Guarda la sesión en memoria y persiste el refresh token. Conserva la última actividad conocida. */
export function writeSession(session: StoredSession): void {
  current = session;
  const previous = readPersisted();
  persist({
    refresh_token: session.refresh_token,
    last_activity: previous?.last_activity ?? Date.now(),
  });
}

/** Registra actividad del usuario ahora (inicio de sesión, recarga, interacción). */
export function markActivity(at: number = Date.now()): void {
  const p = readPersisted();
  if (!p) return;
  persist({ ...p, last_activity: at });
}

/** Elimina la sesión de memoria y la persistida. */
export function clearSession(): void {
  current = null;
  try {
    window.localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible.
  }
}

/** Refresh token y última actividad persistidos, o null. */
export function readPersisted(): PersistedSession | null {
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isPersisted(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persist(value: PersistedSession): void {
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento la sesión sigue en memoria durante la pestaña.
  }
}

export function getAccessToken(): string | null {
  return current?.access_token ?? null;
}
