import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { executeRemoteSeed, validateRemoteSeedRequest } from './seed-remote.mjs';

const seedFile = path.resolve('supabase/seed.sql');

test('preview seeding requires a fresh branch', () => {
  assert.throws(
    () =>
      validateRemoteSeedRequest(
        {
          target: 'preview',
          databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
          seedFile,
          freshBranch: false,
          allowDestroy: false,
          dryRun: true,
        },
        { ICONIC_ENV_TIER: 'preview' },
      ),
    /Preview seeding requires --fresh-branch/,
  );
});

test('staging reseed requires destructive confirmation', () => {
  assert.throws(
    () =>
      validateRemoteSeedRequest(
        {
          target: 'staging',
          databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
          seedFile,
          freshBranch: false,
          allowDestroy: false,
          dryRun: true,
        },
        { ICONIC_ENV_TIER: 'staging' },
      ),
    /Staging reseed requires --allow-destroy/,
  );
});

test('remote seeding is blocked in production', () => {
  assert.throws(
    () =>
      validateRemoteSeedRequest(
        {
          target: 'preview',
          databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
          seedFile,
          freshBranch: true,
          allowDestroy: false,
          dryRun: true,
        },
        { ICONIC_ENV_TIER: 'production' },
      ),
    /blocked when ICONIC_ENV_TIER=production/,
  );
});

test('dry run validates env target then skips psql execution', () => {
  const calls = [];
  executeRemoteSeed(
    {
      target: 'preview',
      databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
      seedFile,
      envValidationTarget: 'preview',
      projectRef: 'preview-ref',
      dryRun: true,
    },
    {
      ICONIC_ENV_TIER: 'preview',
    },
    (command, args, options) => {
      calls.push({ command, args, options });
    },
    '/usr/local/bin/node',
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, '/usr/local/bin/node');
  assert.deepEqual(calls[0].args.slice(-2), ['--target', 'preview']);
});
