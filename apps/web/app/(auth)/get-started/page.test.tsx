import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from '@iconicedu/web/app/(auth)/get-started/page';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

describe('global get-started page', () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it('redirects to the default org get-started route', async () => {
    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/i/get-started');
  });
});
