import { createBrowserClient } from '@supabase/ssr';
import { getPublicWebEnv } from '@iconicedu/web/lib/config/env';

export const createSupabaseBrowserClient = () => {
  const { supabaseUrl, supabasePublishableKey } = getPublicWebEnv();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
};
