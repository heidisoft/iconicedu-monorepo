import type { SupabaseClient } from '@supabase/supabase-js';

const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(
  /\/+$/,
  '',
);

type QueryParams = Record<string, string | number | boolean | null | undefined>;

async function getAuthHeaders(supabase: SupabaseClient): Promise<Record<string, string>> {
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

export function createApiClient(supabase: SupabaseClient) {
  async function get<T>(path: string, params?: QueryParams): Promise<T> {
    const query = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.set(key, String(value));
    });

    const url = `${API_URL}${path}${query.size ? `?${query.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: await getAuthHeaders(supabase),
    });

    return parseResponse<T>(response);
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: await getAuthHeaders(supabase),
      body: JSON.stringify(body),
    });

    return parseResponse<T>(response);
  }

  async function put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: await getAuthHeaders(supabase),
      body: JSON.stringify(body ?? {}),
    });

    return parseResponse<T>(response);
  }

  async function del<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(supabase),
      body: JSON.stringify(body ?? {}),
    });

    return parseResponse<T>(response);
  }

  return { get, post, put, delete: del };
}
