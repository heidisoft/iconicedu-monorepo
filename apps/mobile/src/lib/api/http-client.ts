import { supabase } from '@/lib/supabase/client';

function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configured) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured');
  }

  return configured.replace(/\/+$/g, '');
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(errorBody?.message ?? `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}
