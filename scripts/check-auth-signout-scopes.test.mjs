import test from 'node:test';
import assert from 'node:assert/strict';

import { findScopeLessAuthSignOutCalls } from './check-auth-signout-scopes.mjs';

test('accepts every explicit Supabase sign-out scope', () => {
  const violations = findScopeLessAuthSignOutCalls(
    'apps/web/example.ts',
    `
      await supabase.auth.signOut({ scope: 'local' });
      await supabase.auth.signOut({ scope: 'global' });
      await supabase.auth.signOut({ scope: 'others' });
    `,
  );

  assert.deepEqual(violations, []);
});

test('rejects scope-less and opaque Supabase sign-out options', () => {
  const violations = findScopeLessAuthSignOutCalls(
    'apps/mobile/example.tsx',
    `
      await supabase.auth.signOut();
      await supabase.auth.signOut({});
      await supabase.auth.signOut(options);
    `,
  );

  assert.equal(violations.length, 3);
  assert.deepEqual(
    violations.map(({ line }) => line),
    [2, 3, 4],
  );
});

test('ignores comments, mocks, and explicitly scoped admin sign-out', () => {
  const violations = findScopeLessAuthSignOutCalls(
    'apps/web/example.test.ts',
    `
      // supabase.auth.signOut()
      const signOut = vi.fn();
      await client.auth.admin.signOut(jwt, 'global');
    `,
  );

  assert.deepEqual(violations, []);
});
