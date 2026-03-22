import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreviewBranchName,
  findProjectRef,
  normalizeUrl,
  slugifyBranch,
} from './utils.mjs';

test('slugifyBranch produces a stable preview-safe token', () => {
  assert.equal(slugifyBranch('Feature/Preview Env!'), 'feature-preview-env');
});

test('buildPreviewBranchName includes the pr number and sanitized branch', () => {
  assert.equal(
    buildPreviewBranchName('42', 'Feature/Preview Env!'),
    'pr-42-feature-preview-env',
  );
});

test('normalizeUrl accepts hosts without a scheme', () => {
  assert.equal(
    normalizeUrl('preview.example.vercel.app'),
    'https://preview.example.vercel.app',
  );
});

test('findProjectRef can resolve nested Supabase branch refs', () => {
  const payload = {
    branch: {
      project_ref: 'abcdefghijklmnopqrst',
      status: 'healthy',
    },
  };

  assert.equal(findProjectRef(payload), 'abcdefghijklmnopqrst');
});
