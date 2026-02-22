import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/accounts/login-eligibility/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const { mockGetOrgBySlug, mockGetAccountByEmail } = vi.hoisted(() => ({
  mockGetOrgBySlug: vi.fn(),
  mockGetAccountByEmail: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({
  getOrgBySlug: mockGetOrgBySlug,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByEmail: mockGetAccountByEmail,
}));

describe('POST /api/accounts/login-eligibility', () => {
  beforeEach(() => {
    mockGetOrgBySlug.mockReset();
    mockGetAccountByEmail.mockReset();
  });

  it('returns 400 for invalid email', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/accounts/login-eligibility`, {
        method: 'POST',
        body: JSON.stringify({ orgSlug: 'iconic-academy', email: 'bad-email' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      eligible: false,
      message: 'Valid email is required.',
    });
  });

  it('returns not eligible when account is missing', async () => {
    mockGetOrgBySlug.mockResolvedValueOnce({
      data: { id: 'org-1', slug: 'iconic-academy' },
      error: null,
    });
    mockGetAccountByEmail.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/accounts/login-eligibility`, {
        method: 'POST',
        body: JSON.stringify({ orgSlug: 'iconic-academy', email: 'parent@example.com' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      eligible: false,
      reason: 'missing_account',
      message: 'No existing account found for this organization. Use Get started instead.',
    });
  });

  it('returns eligible when account exists', async () => {
    mockGetOrgBySlug.mockResolvedValueOnce({
      data: { id: 'org-1', slug: 'iconic-academy' },
      error: null,
    });
    mockGetAccountByEmail.mockResolvedValueOnce({
      data: { id: 'account-1', status: 'active' },
      error: null,
    });

    const response = await POST(
      new Request(`${APP_URL}/api/accounts/login-eligibility`, {
        method: 'POST',
        body: JSON.stringify({ orgSlug: 'iconic-academy', email: 'parent@example.com' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eligible: true });
  });
});
