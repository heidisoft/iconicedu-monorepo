import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateFeatureFlagGating } from './check-feature-flag-gating.mjs';

test('passes when no feature-bearing files changed', () => {
  const violations = evaluateFeatureFlagGating({
    changedFiles: ['README.md'],
    sources: {},
    prBody: '',
    commitMessage: '',
  });

  assert.equal(violations.length, 0);
});

test('passes for web infrastructure-only changes', () => {
  const violations = evaluateFeatureFlagGating({
    changedFiles: [
      'apps/web/app/layout.tsx',
      'apps/web/lib/config/env.ts',
      'apps/web/lib/notifications/providers/email-provider.ts',
      'apps/web/lib/notifications/providers/sms-provider.ts',
    ],
    sources: {
      'apps/web/app/layout.tsx': 'export default function RootLayout() { return null; }',
      'apps/web/lib/config/env.ts': 'export function validateWebRuntimeEnv() {}',
      'apps/web/lib/notifications/providers/email-provider.ts':
        'export async function sendEmailNotification() {}',
      'apps/web/lib/notifications/providers/sms-provider.ts':
        'export async function sendSmsNotification() {}',
    },
    prBody: '',
    commitMessage: '',
  });

  assert.equal(violations.length, 0);
});

test('fails when feature-bearing file changes without flag usage', () => {
  const violations = evaluateFeatureFlagGating({
    changedFiles: ['apps/web/app/(app)/[orgSlug]/page.tsx'],
    sources: {
      'apps/web/app/(app)/[orgSlug]/page.tsx':
        'export default function Page() { return null; }',
    },
    prBody: '',
    commitMessage: '',
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.code, 'feature-flags.required');
});

test('passes when feature-bearing change references flags catalog', () => {
  const violations = evaluateFeatureFlagGating({
    changedFiles: ['apps/web/app/(app)/[orgSlug]/page.tsx'],
    sources: {
      'apps/web/app/(app)/[orgSlug]/page.tsx':
        "import { enableMessageTypeComposer } from '@iconicedu/web/flags';\nawait enableMessageTypeComposer.run({});",
    },
    prBody: '',
    commitMessage: '',
  });

  assert.equal(violations.length, 0);
});

test('passes with explicit exemption tag', () => {
  const violations = evaluateFeatureFlagGating({
    changedFiles: ['apps/web/app/(app)/[orgSlug]/page.tsx'],
    sources: {
      'apps/web/app/(app)/[orgSlug]/page.tsx':
        'export default function Page() { return null; }',
    },
    prBody: 'flag-exempt: maintenance-only',
    commitMessage: '',
  });

  assert.equal(violations.length, 0);
});
