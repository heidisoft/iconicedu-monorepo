import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCommitMessage } from './check-commit-message.mjs';

test('accepts repository Conventional Commit headers', () => {
  for (const message of [
    'feat(web): add guardian dashboard filters',
    'fix: prevent duplicate messages',
    'docs(workflow): explain local setup',
    'feat(api)!: remove legacy endpoint',
  ]) {
    assert.equal(validateCommitMessage(message).valid, true, message);
  }
});

test('accepts generated merge and revert commits', () => {
  assert.equal(
    validateCommitMessage('Merge pull request #123 from team/feat/example').valid,
    true,
  );
  assert.equal(validateCommitMessage('Revert "feat(web): add example"').valid, true);
});

test('rejects missing types, unsupported types, and malformed subjects', () => {
  for (const message of [
    'Add guardian dashboard filters',
    'feature(web): add guardian dashboard filters',
    'feat(web): Add guardian dashboard filters',
    'feat(web): add guardian dashboard filters.',
  ]) {
    assert.equal(validateCommitMessage(message).valid, false, message);
  }
});
