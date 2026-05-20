import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';

function resolveApiUrl(): string {
  const configuredUrl = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ''
  ).trim();

  if (configuredUrl && configuredUrl !== 'undefined') {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_LOCAL_API_URL;
  }

  throw new Error('API_URL or NEXT_PUBLIC_API_URL is required');
}

export async function proxyPostToApi(request: Request, path: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const targetUrl = new URL(`${resolveApiUrl()}${path}`);
  requestUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const body = await request.text();
  const response = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
    },
    body,
  });

  const responseBody = await response.text();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
