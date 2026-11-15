import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  BASELINE_PATH,
  DYNAMIC_TABLE,
  collectTableAccesses,
  evaluate,
  findTableAccesses,
  toBaseline,
} from './check-frontend-table-access.mjs';

test('finds single-line, multi-line, template, and dynamic table reads', () => {
  const accesses = findTableAccesses(
    'apps/web/lib/example.ts',
    `
      await supabase.from('profiles').select('*');
      await supabase
        .from(
          'class_schedules',
        )
        .select('*');
      await client.from(\`orgs\`).select('*');
      await supabase.from(tableName).select('*');
    `,
  );

  assert.deepEqual(
    accesses.map(({ table }) => table),
    ['profiles', 'class_schedules', 'orgs', DYNAMIC_TABLE],
  );
});

test('ignores Array.from, Buffer.from, Storage buckets, and comments', () => {
  const accesses = findTableAccesses(
    'apps/web/lib/example.ts',
    `
      Array.from(new Set(ids));
      Array.from('abc');
      Buffer.from('payload');
      await supabase.storage.from('message-files').upload(path, file);
      const storage = supabase.storage;
      await storage.from('avatars').remove([path]);
      // supabase.from('profiles')
    `,
  );

  assert.deepEqual(accesses, []);
});

test('rejects a table read in a file that is not baselined', () => {
  const violations = evaluate(
    { 'apps/web/lib/new-feature.ts': { profiles: [3] } },
    { files: {} },
  );

  assert.equal(violations.length, 1);
  assert.match(
    violations[0],
    /apps\/web\/lib\/new-feature\.ts:3 adds a direct Supabase read of "profiles"/,
  );
});

test('rejects a new table in an already-baselined file', () => {
  const violations = evaluate(
    { 'apps/web/lib/legacy.ts': { profiles: [3], orgs: [9] } },
    { files: { 'apps/web/lib/legacy.ts': ['profiles'] } },
  );

  assert.deepEqual(violations.length, 1);
  assert.match(violations[0], /"orgs"/);
});

test('rejects stale baseline entries so the ratchet only tightens', () => {
  const violations = evaluate(
    { 'apps/web/lib/legacy.ts': { profiles: [3] } },
    {
      files: {
        'apps/web/lib/legacy.ts': ['profiles', 'orgs'],
        'apps/web/lib/gone.ts': ['x'],
      },
    },
  );

  assert.equal(violations.length, 2);
  assert.ok(violations.every((violation) => violation.includes('no longer reads it')));
});

test('API-only paths fail even when baselined', () => {
  const usage = {
    'apps/web/lib/schedules/queries/class-schedule.query.ts': { class_schedules: [20] },
  };
  const violations = evaluate(usage, {
    files: {
      'apps/web/lib/schedules/queries/class-schedule.query.ts': ['class_schedules'],
    },
  });

  assert.equal(violations.length, 2);
  assert.match(violations[0], /API-only; use GET \/schedules\/calendar/);
  assert.match(violations[1], /cannot be baselined/);
  assert.deepEqual(toBaseline(usage), { files: {} });
});

test('regression: the pre-migration apps/web schedule reads would be rejected', () => {
  // The exact shape of the deleted apps/web/lib/schedules/queries/class-schedule.query.ts.
  const legacy = `
    export async function getClassSchedulesByOrg(supabase, orgId) {
      return supabase
        .from('class_schedules')
        .select(CLASS_SCHEDULE_SELECT)
        .eq('org_id', orgId);
    }
    export async function getParticipants(supabase, orgId, ids) {
      return supabase.from('class_schedule_participants').select('*').in('schedule_id', ids);
    }
  `;
  const filePath = 'apps/web/lib/schedules/queries/class-schedule.query.ts';
  const usage = {
    [filePath]: Object.fromEntries(
      findTableAccesses(filePath, legacy).map(({ table, line }) => [table, [line]]),
    ),
  };

  const violations = evaluate(
    usage,
    JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')),
  ).filter((violation) => violation.startsWith(filePath));
  assert.equal(violations.length, 2);
  assert.ok(violations.every((violation) => violation.includes('API-only')));
});

test('the committed baseline matches the current tree', () => {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  assert.deepEqual(evaluate(collectTableAccesses(), baseline), []);
  assert.deepEqual(toBaseline(collectTableAccesses()), baseline);
});
