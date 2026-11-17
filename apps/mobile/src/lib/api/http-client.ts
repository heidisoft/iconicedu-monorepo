import { ApiHttpError } from './http-error';
import { supabase } from '@/lib/supabase/client';

function resolveApiBaseUrl(): string {
  const configured = (
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    ''
  ).trim();
  if (!configured) {
    throw new Error('Missing required environment variable: API_URL');
  }

  return configured.replace(/\/+$/g, '');
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiHttpError(
      errorBody?.message ?? `API error ${response.status}`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  });

  return parseResponse<T>(response);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body ?? {}),
  });

  return parseResponse<T>(response);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body ?? {}),
  });

  return parseResponse<T>(response);
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body ?? {}),
  });

  return parseResponse<T>(response);
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });

  const url = `${resolveApiBaseUrl()}${path}${query.size ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  return parseResponse<T>(response);
}

/** Meeting-scoped capabilities are verified by apps/api, not by Supabase auth. */
export async function capabilityGet<T>(path: string, token: string): Promise<T> {
  return parseResponse<T>(
    await fetch(`${resolveApiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store' },
    }),
  );
}
export async function capabilityPost<T>(
  path: string,
  token: string,
  body: unknown,
): Promise<T> {
  return parseResponse<T>(
    await fetch(`${resolveApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );
}

/** Existing public API routes may use a signed-in identity, but also accept guests. */
async function getOptionalAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}
export async function publicApiGet<T>(path: string): Promise<T> {
  return parseResponse<T>(
    await fetch(`${resolveApiBaseUrl()}${path}`, {
      headers: await getOptionalAuthHeaders(),
    }),
  );
}
export async function publicApiPost<T>(path: string, body: unknown): Promise<T> {
  return parseResponse<T>(
    await fetch(`${resolveApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: await getOptionalAuthHeaders(),
      body: JSON.stringify(body),
    }),
  );
}
