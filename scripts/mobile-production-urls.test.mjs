import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolveMobileProductionUrls } from './resolve-mobile-production-urls.mjs';

const require = createRequire(import.meta.url);
const yaml = require('yaml');
const configured = {
  API_URL: 'https://api.example.invalid/',
  WEB_URL: 'https://app.example.invalid/',
};
const discovery = {
  RAILWAY_API_TOKEN: 'synthetic-token',
  RAILWAY_PROJECT_ID: 'project',
  RAILWAY_SERVICE_ID: 'api-service',
  REPOSITORY_NAME: 'repo',
  VERCEL_TOKEN: 'synthetic-token',
  VERCEL_PROJECT_ID: 'web-project',
  VERCEL_ORG_ID: 'team_synthetic',
};
const response = (data) => ({ ok: true, json: async () => data });

test('configured production origins bypass provider discovery and credentials', async () => {
  const result = await resolveMobileProductionUrls(configured, () =>
    assert.fail('must not contact providers'),
  );
  assert.deepEqual(result, {
    apiUrl: 'https://api.example.invalid',
    webUrl: 'https://app.example.invalid',
  });
});

test('discovers Railway production service and ready Vercel main deployment when unconfigured', async () => {
  const calls = [];
  const result = await resolveMobileProductionUrls(discovery, async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1)
      return response({
        data: {
          project: {
            environments: { edges: [{ node: { id: 'prod', name: 'production' } }] },
            services: { edges: [{ node: { id: 'wrong-service', name: 'repo' } }] },
          },
        },
      });
    if (calls.length === 2)
      return response({
        data: {
          domains: {
            customDomains: [{ domain: 'api.example.invalid' }],
            serviceDomains: [{ domain: 'fallback.example.invalid' }],
          },
        },
      });
    return response({ deployments: [{ url: 'web.example.invalid' }] });
  });
  assert.deepEqual(result, {
    apiUrl: 'https://api.example.invalid',
    webUrl: 'https://web.example.invalid',
  });
  assert.equal(calls[0].url, 'https://backboard.railway.com/graphql/v2');
  assert.deepEqual(JSON.parse(calls[1].options.body).variables, {
    projectId: 'project',
    environmentId: 'prod',
    serviceId: 'api-service',
  });
  const query = new URL(calls[2].url).searchParams;
  assert.equal(query.get('state'), 'READY');
  assert.equal(query.get('target'), 'production');
  assert.equal(query.get('meta-githubCommitRef'), 'main');
  assert.equal(query.get('teamId'), 'team_synthetic');
});

test('uses only the missing origin provider', async () => {
  const result = await resolveMobileProductionUrls(
    { ...discovery, API_URL: configured.API_URL },
    async (url) => {
      assert.equal(new URL(url).hostname, 'api.vercel.com');
      return response({ deployments: [{ url: 'web.example.invalid' }] });
    },
  );
  assert.equal(result.apiUrl, 'https://api.example.invalid');
});

for (const [label, request, pattern] of [
  ['HTTP failure', async () => ({ ok: false, status: 401 }), /Railway.*HTTP 401/],
  [
    'GraphQL failure',
    async () => response({ errors: [{ message: 'sensitive-provider-payload' }] }),
    /Railway.*GraphQL errors/,
  ],
  [
    'network failure',
    async () => {
      throw new Error('sensitive-provider-payload');
    },
    /Railway.*request failed/,
  ],
  [
    'invalid JSON',
    async () => ({
      ok: true,
      json: async () => {
        throw new Error('sensitive-provider-payload');
      },
    }),
    /Railway.*invalid JSON/,
  ],
]) {
  test(`reports ${label} without leaking provider payloads`, async () => {
    await assert.rejects(resolveMobileProductionUrls(discovery, request), (error) => {
      assert.match(error.message, pattern);
      assert.doesNotMatch(error.message, /sensitive-provider-payload/);
      return true;
    });
  });
}

test('fails closed when no production service or domain exists', async () => {
  await assert.rejects(
    resolveMobileProductionUrls(discovery, async () => response({ data: {} })),
    /environment or service not found/,
  );
});

test('rejects unsafe configured origins before contacting providers', async () => {
  for (const invalid of [
    'http://api.example.invalid',
    'https://user:password@api.example.invalid',
    'https://api.example.invalid/path',
    'https://api.example.invalid/?token=value',
  ]) {
    await assert.rejects(
      resolveMobileProductionUrls({ ...configured, API_URL: invalid }, () =>
        assert.fail('must not contact providers'),
      ),
      /API_URL must be an HTTPS origin/,
    );
  }
});

test('fails without publishing when Vercel has no ready production deployment', async () => {
  await assert.rejects(
    resolveMobileProductionUrls({ ...discovery, API_URL: configured.API_URL }, async () =>
      response({ deployments: [] }),
    ),
    /No ready Vercel production deployment/,
  );
});

test('CLI prints actionable failures to stderr instead of swallowing them', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/resolve-mobile-production-urls.mjs'],
    { env: {}, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /::error::Missing RAILWAY_API_TOKEN/);
});

test('OTA workflow passes existing production origins to the resolver', () => {
  const workflow = yaml.parse(readFileSync('.github/workflows/eas-update.yml', 'utf8'));
  const step = workflow.jobs['eas-update'].steps.find((step) => step.id === 'app-urls');
  assert.equal(step.run, 'node scripts/resolve-mobile-production-urls.mjs');
  assert.equal(step.env.API_URL, '${{ vars.API_URL || secrets.API_URL }}');
  assert.equal(step.env.WEB_URL, '${{ vars.WEB_URL || secrets.WEB_URL }}');
});
