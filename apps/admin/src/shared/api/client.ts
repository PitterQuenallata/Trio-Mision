import { ApiErrorResponse } from './types';

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

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('blakor_auth_token');
    }
    return null;
  }

  private handleUnauthorized() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('blakor_auth_token');
      // Dispatch custom auth event or redirect to login
      window.dispatchEvent(new CustomEvent('blakor:unauthorized'));
    }
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...customConfig } = options;

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const token = this.getToken();
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };

    try {
      const response = await fetch(url, {
        headers: defaultHeaders,
        ...customConfig,
      });

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new ApiError('Sesión expirada o no autorizada', 401);
      }

      if (!response.ok) {
        let errorData: ApiErrorResponse = {
          message: `Error HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
        try {
          const parsed = await response.json();
          errorData = { ...errorData, ...parsed };
        } catch {
          // Response body was not JSON
        }
        throw new ApiError(errorData.message, response.status, errorData.errors);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        err instanceof Error ? err.message : 'Error desconocido de red',
        500
      );
    }
  }

  public get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  public post<T>(endpoint: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      params,
    });
  }

  public put<T>(endpoint: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      params,
    });
  }

  public patch<T>(endpoint: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      params,
    });
  }

  public delete<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', params });
  }
}

// Base de la API de Trio Misión (services/api). Se configura con VITE_API_URL.
export const http = new HttpClient(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080');
