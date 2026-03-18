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
