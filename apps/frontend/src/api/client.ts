const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Single fetch wrapper for the whole app.
 *
 * credentials: 'include' on every call is what makes the session cookie work
 * cross-origin in dev, where the SPA is on :5173 and the API on :4000.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    // Error bodies are JSON by convention, but a proxy or crash can return
    // HTML, so fall back to the status text rather than throwing while parsing.
    let message = response.statusText;
    let details: unknown;
    try {
      const parsed = (await response.json()) as { error?: string; details?: unknown };
      message = parsed.error ?? message;
      details = parsed.details;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiUrl = (path: string): string => `${API_URL}${path}`;

/**
 * React Query types mutation errors as plain Error, so narrowing to ApiError
 * in a callback signature does not typecheck. This pulls a message out of
 * whatever was actually thrown.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
