import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const workflow = require('yaml').parse(
  fs.readFileSync('.github/workflows/ci.yml', 'utf8'),
);
const steps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);
const renderer = steps.find((step) => step.run?.includes('const manifestPath ='));
const script = renderer.run.split("node <<'NODE'\n")[1].split('\nNODE')[0];
const manifest = JSON.parse(fs.readFileSync('ops/env/production.env.json', 'utf8'));

function render(extra = {}) {
  const secrets = Object.fromEntries(
    [
      'RAILWAY_API_TOKEN',
      'RAILWAY_PROJECT_ID',
      'VERCEL_TOKEN',
      'VERCEL_PROJECT_ID',
      'VERCEL_ORG_ID',
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_PROJECT_ID',
    ].map((key) => [key, `synthetic-${key}`]),
  );
  for (const entries of Object.values(manifest)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry.optional && !entry.value)
        secrets[entry.source ?? entry.sources?.[0]] = 'synthetic';
    }
  }
  Object.assign(secrets, extra);
  const files = new Map();
  vm.runInNewContext(script, {
    require: (name) =>
      name === 'node:path'
        ? path
        : {
            readFileSync: () => JSON.stringify(manifest),
            existsSync: () => false,
            mkdirSync: () => {},
            writeFileSync: (file, data) => files.set(path.basename(file), data),
          },
    process: {
      env: { CI_SECRETS_JSON: JSON.stringify(secrets) },
      exit: () => {
        throw new Error('missing deployment configuration');
      },
    },
    console: { log: () => {}, error: () => {} },
  });
  return JSON.parse(files.get('railway.json'));
}
test('external meeting deployments require no Zoom configuration', () => {
  assert.equal(render().ZOOM_VIDEO_SDK_KEY, undefined);
});
test('SDK deployments supply credentials and public URL to the API', () => {
  const config = {
    ZOOM_VIDEO_SDK_KEY: 'synthetic-key',
    ZOOM_VIDEO_SDK_SECRET: 'synthetic-secret',
    WEB_URL: 'https://app.invalid',
  };
  const result = render(config);
  for (const [key, value] of Object.entries(config)) assert.equal(result[key], value);
});
test('SDK deployments reject incomplete credentials and unsafe origins', () => {
  assert.throws(() => render({ ZOOM_VIDEO_SDK_KEY: 'synthetic' }), /missing deployment/);
  assert.throws(
    () =>
      render({
        ZOOM_VIDEO_SDK_KEY: 'synthetic',
        ZOOM_VIDEO_SDK_SECRET: 'synthetic',
        WEB_URL: 'http://localhost:3000',
      }),
    /HTTPS/,
  );
});
test('production applies schema before API deployment and preview configures its web URL first', () => {
  assert.ok(
    steps.findIndex(
      (step) =>
        step.name === 'Apply production database migrations before API deployment',
    ) <
      steps.findIndex(
        (step) => step.name === 'Configure Railway production env and trigger deploy',
      ),
  );
  const preview = steps.find(
    (step) => step.name === 'Configure Railway preview web URL and deploy',
  );
  assert.ok(
    preview.run.indexOf('name:"WEB_URL"') <
      preview.run.indexOf('mutation environmentTriggersDeploy'),
  );
});

test('preview rebuilds protect the parent and retain normal pushes without schema changes', async () => {
  const { spawnSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'preview-migrations-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'supabase'),
      '#!/bin/bash\necho "$*" >> "$CALLS"\nexit "${MOCK_EXIT:-0}"\n',
      { mode: 0o700 },
    );
    const step = steps.find((s) => s.name === 'Apply preview branch migrations');
    const run = (isNew, preview, parent, exitCode = '0', schemaChanged = 'false') => {
      const calls = path.join(dir, 'calls');
      fs.writeFileSync(calls, '');
      const script = step.run
        .replaceAll('${{ steps.supabase-branch.outputs.branch_new }}', isNew)
        .replaceAll('${{ needs.changes.outputs.supabase }}', schemaChanged)
        .replaceAll('${{ steps.supabase-branch.outputs.branch_ref }}', preview)
        .replaceAll('${{ vars.SUPABASE_PROJECT_ID }}', parent);
      const result = spawnSync('bash', ['-c', script], {
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          CALLS: calls,
          MOCK_EXIT: exitCode,
        },
        encoding: 'utf8',
      });
      return { status: result.status, calls: fs.readFileSync(calls, 'utf8') };
    };
    assert.deepEqual(run('true', 'preview', 'parent'), {
      status: 0,
      calls: 'db reset --linked --yes\n',
    });
    for (const [preview, parent] of [
      ['parent', 'parent'],
      ['', 'parent'],
      ['null', 'parent'],
      ['preview', ''],
    ]) {
      assert.deepEqual(run('true', preview, parent), { status: 1, calls: '' });
    }
    assert.match(run('false', 'preview', 'parent').calls, /^db push /);
    assert.equal(
      run('false', 'preview', 'parent', '0', 'true').calls,
      'db reset --linked --yes\n',
    );
    assert.equal(run('false', 'parent', 'parent', '0', 'true').status, 1);
    assert.equal(run('true', 'preview', 'parent', '1').status, 1);
    assert.equal(run('false', 'preview', 'parent', '1').status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
