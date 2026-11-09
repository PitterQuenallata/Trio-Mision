// Cliente tipado de la API de Trio Misión. Los tipos salen de
// src/shared/api/generated/openapi.ts (regenerar con `pnpm api:types` tras
// cambiar la API). Vacío = mismo origen: en desarrollo Vite reenvía /api.
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './generated/openapi';
import { getAccessToken } from '../auth/session';

/** Error de la API con el mensaje y los errores de campo que devuelve. */
export class ApiError extends Error {
  public statusCode: number;
  public errors?: Record<string, string[]>;

  constructor(message: string, statusCode: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = getAccessToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ response }) {
    // La sesión ya no es válida: el AuthProvider cierra la sesión al recibir el evento.
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('blakor:unauthorized'));
    }
    return response;
  },
};

const baseUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export const api = createClient<paths>({ baseUrl });
api.use(authMiddleware);

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Convierte la respuesta de openapi-fetch en el dato o lanza ApiError.
 * Uso: const pagos = await unwrap(api.GET('/api/v1/staff/pagos', {}));
 */
export async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok || error !== undefined) {
    // Huma responde con { title, status, detail } (RFC 9457); "detail" es el motivo legible.
    const body = (error ?? {}) as { detail?: string; message?: string; errors?: Record<string, string[]> };
    throw new ApiError(body.detail ?? body.message ?? `Error HTTP ${response.status}`, response.status, body.errors);
  }
  return data as T;
}
