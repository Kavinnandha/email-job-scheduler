const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export class ApiError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
        this.name = 'ApiError';
    }
}
/**
 * Single fetch wrapper for the whole app.
 *
 * credentials: 'include' on every call is what makes the session cookie work
 * cross-origin in dev, where the SPA is on :5173 and the API on :4000.
 */
export async function apiRequest(path, options = {}) {
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
        let details;
        try {
            const parsed = (await response.json());
            message = parsed.error ?? message;
            details = parsed.details;
        }
        catch {
            /* non-JSON error body */
        }
        throw new ApiError(message, response.status, details);
    }
    if (response.status === 204)
        return undefined;
    return (await response.json());
}
export const apiUrl = (path) => `${API_URL}${path}`;
/**
 * React Query types mutation errors as plain Error, so narrowing to ApiError
 * in a callback signature does not typecheck. This pulls a message out of
 * whatever was actually thrown.
 */
export function errorMessage(error, fallback = 'Something went wrong') {
    if (error instanceof ApiError)
        return error.message;
    if (error instanceof Error)
        return error.message;
    return fallback;
}
