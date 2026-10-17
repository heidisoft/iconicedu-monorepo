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

test('seeded classrooms default to Video SDK sessions without custom meeting links', () => {
  const seed = fs.readFileSync('supabase/seed.sql', 'utf8');
  const channels = seed.split('INSERT INTO "public"."channels"')[1].split(';')[0];
  const configs = [...channels.matchAll(/'(\{"mode": "video"[^']*\})'/g)].map(
    ([, json]) => JSON.parse(json),
  );
  assert.equal(configs.length, 7, 'all seeded classrooms have live-session defaults');
  for (const config of configs) {
    assert.equal(config.enabled, true);
    assert.equal(config.provider, 'zoom');
    assert.equal(config.joinUrl, undefined, 'Video SDK generates its own join access');
  }
});
