import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';

function resolveApiUrl(): string {
  const configuredUrl = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ''
  ).trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_LOCAL_API_URL;
  }

  throw new Error('API_URL or NEXT_PUBLIC_API_URL is required');
}

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

  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type') ?? '';
  if (
    response.status === 204 ||
    contentLength === '0' ||
    !contentType.includes('application/json')
  ) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function createApiClient(supabase: SupabaseClient) {
  const apiUrl = resolveApiUrl();

  async function get<T>(path: string, params?: QueryParams): Promise<T> {
    const query = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.set(key, String(value));
    });

    const url = `${apiUrl}${path}${query.size ? `?${query.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: await getAuthHeaders(supabase),
    });

    return parseResponse<T>(response);
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: await getAuthHeaders(supabase),
      body: JSON.stringify(body),
    });

    return parseResponse<T>(response);
  }

  async function put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'PUT',
      headers: await getAuthHeaders(supabase),
      body: JSON.stringify(body ?? {}),
    });

    return parseResponse<T>(response);
  }

  async function del<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(supabase),
      body: JSON.stringify(body ?? {}),
    });

    return parseResponse<T>(response);
  }

  return { get, post, put, delete: del };
}
