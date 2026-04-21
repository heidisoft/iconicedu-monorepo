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
    throw new Error(errorBody?.message ?? `API error ${response.status}`);
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
