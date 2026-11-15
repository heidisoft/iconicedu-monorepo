import { describe, expect, it, vi } from 'vitest';
import { getAdminLiveSessionQualityEvents } from './live-session-attendance';
const { get, supabase } = vi.hoisted(() => ({
  get: vi.fn(async () => []),
  supabase: {},
}));
vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => supabase),
}));
vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ get })),
}));
describe('meeting quality API adapter', () => {
  it('requests scoped events through the authenticated API', async () => {
    await expect(getAdminLiveSessionQualityEvents('org', 'session')).resolves.toEqual([]);
    expect(get).toHaveBeenCalledWith(
      '/live-sessions/session/quality-events',
      { orgId: 'org' },
      { cache: 'no-store' },
    );
  });
});
