'use server';

import type { ChildProfileVM, ThemeKey } from '@iconicedu/shared-types';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

type CreateChildProfileInput = {
  orgId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  birthYear: number;
  email?: string | null;
  timezone?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  postalCode?: string | null;
  themeKey?: ThemeKey | null;
};

export async function createChildProfileAction(
  input: CreateChildProfileInput,
): Promise<ChildProfileVM> {
  const supabase = await createSupabaseServerClient();
  const api = createApiClient(supabase);
  return api.post<ChildProfileVM>('/profiles/children', input);
}
