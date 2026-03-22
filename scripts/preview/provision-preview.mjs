import {
  buildPreviewBranchName,
  buildSupabaseHeaders,
  buildVercelHeaders,
  dashboardUrlForProjectRef,
  encodeStoragePath,
  findProjectRef,
  formatIsoNow,
  optionalEnv,
  parseArgs,
  requireEnv,
  normalizeUrl,
  requireArg,
  runCommand,
  runJsonCommand,
  sleep,
  toSummaryError,
  writeJsonFile,
} from './utils.mjs';
import { PREVIEW_USERS, STORAGE_FIXTURES } from './fixtures.mjs';
import { readFile } from 'node:fs/promises';

const DEFAULT_STATUS_FILE = '.tmp/preview-status.json';
const SUPABASE_CLI_WORKDIR = 'supabase';
const DEFAULT_BRANCH_WAIT_ATTEMPTS = 90;
const DEFAULT_BRANCH_WAIT_INTERVAL_MS = 10_000;

async function ensureSupabaseBranch(branchName, projectRef) {
  const getArgs = [
    'branches',
    'get',
    branchName,
    '--project-ref',
    projectRef,
    '-o',
    'json',
  ];
  const existing = await runCommand('supabase', getArgs, {
    cwd: SUPABASE_CLI_WORKDIR,
    tolerateFailure: true,
  });

  if (existing.ok && existing.stdout) {
    return JSON.parse(existing.stdout);
  }

  return runJsonCommand(
    'supabase',
    ['branches', 'create', branchName, '--project-ref', projectRef, '-o', 'json'],
    { cwd: SUPABASE_CLI_WORKDIR },
  );
}

function getBranchStatus(payload) {
  const queue = [payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (typeof current !== 'object') continue;

    for (const [key, value] of Object.entries(current)) {
      if (typeof value === 'string' && key.toLowerCase() === 'status') {
        return value;
      }
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
}

function isHealthyBranchStatus(status) {
  if (!status) return false;

  const normalized = status.toLowerCase();
  return (
    normalized === 'healthy' ||
    normalized === 'active' ||
    normalized === 'ready' ||
    normalized.includes('healthy') ||
    normalized.includes('ready') ||
    normalized.includes('active')
  );
}

async function waitForHealthyBranch(branchName, projectRef) {
  const maxAttempts = Number.parseInt(
    process.env.SUPABASE_BRANCH_WAIT_ATTEMPTS ?? `${DEFAULT_BRANCH_WAIT_ATTEMPTS}`,
    10,
  );
  const intervalMs = Number.parseInt(
    process.env.SUPABASE_BRANCH_WAIT_INTERVAL_MS ?? `${DEFAULT_BRANCH_WAIT_INTERVAL_MS}`,
    10,
  );

  let lastStatus = 'unknown';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = await runJsonCommand(
      'supabase',
      ['branches', 'get', branchName, '--project-ref', projectRef, '-o', 'json'],
      { cwd: SUPABASE_CLI_WORKDIR },
    );

    const status = getBranchStatus(payload);
    lastStatus = status ?? 'unknown';

    if (isHealthyBranchStatus(status)) {
      return payload;
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `Supabase preview branch ${branchName} did not become healthy in time. Last observed status: ${lastStatus}. Adjust SUPABASE_BRANCH_WAIT_ATTEMPTS or SUPABASE_BRANCH_WAIT_INTERVAL_MS if your project takes longer to provision.`,
  );
}

async function getSupabaseApiKeys(projectRef) {
  return runJsonCommand(
    'supabase',
    ['projects', 'api-keys', '--project-ref', projectRef, '-o', 'json'],
    { cwd: SUPABASE_CLI_WORKDIR },
  );
}

async function applyPreviewDatabaseBootstrap(projectRef) {
  const result = await runCommand(
    'supabase',
    [
      '--project-ref',
      projectRef,
      'db',
      'push',
      '--linked',
      '--include-all',
      '--include-seed',
    ],
    { cwd: SUPABASE_CLI_WORKDIR, tolerateFailure: true },
  );

  if (!result.ok) {
    throw new Error(
      `Failed to apply migrations and seed.sql to preview branch ${projectRef}\n${result.stderr || result.stdout || 'Unknown error'}`,
    );
  }

  return {
    applied: true,
    output: result.stdout || 'Applied migrations and seed.sql with supabase db push.',
  };
}

function normalizeApiKeys(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.keys)
      ? payload.keys
      : [];

  const result = {
    anonKey: null,
    publishableKey: null,
    serviceRoleKey: null,
  };

  for (const item of items) {
    const name = `${item?.name ?? item?.type ?? item?.key ?? ''}`.toLowerCase();
    const value = item?.api_key ?? item?.key ?? item?.value ?? null;
    if (!value || typeof value !== 'string') continue;

    if (!result.anonKey && name.includes('anon')) {
      result.anonKey = value;
    }
    if (!result.publishableKey && name.includes('publishable')) {
      result.publishableKey = value;
    }
    if (
      !result.serviceRoleKey &&
      (name.includes('service_role') || name.includes('service role'))
    ) {
      result.serviceRoleKey = value;
    }
  }

  result.publishableKey ||= result.anonKey;

  if (!result.anonKey || !result.serviceRoleKey || !result.publishableKey) {
    throw new Error('Failed to resolve preview API keys from supabase projects api-keys');
  }

  return result;
}

async function setSupabaseSecrets(projectRef, secrets) {
  const entries = Object.entries(secrets)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => `${key}=${value}`);

  if (entries.length === 0) return;

  await runCommand(
    'supabase',
    ['secrets', 'set', '--project-ref', projectRef, ...entries],
    { cwd: SUPABASE_CLI_WORKDIR },
  );
}

async function deployEdgeFunctions(projectRef) {
  const functions = [
    'channel-read-state-repair',
    'notifications-dispatch',
    'reminders-dispatch',
  ];

  const deployed = [];
  const failed = [];

  for (const functionName of functions) {
    const result = await runCommand(
      'supabase',
      ['functions', 'deploy', functionName, '--project-ref', projectRef, '--use-api'],
      { cwd: SUPABASE_CLI_WORKDIR, tolerateFailure: true },
    );

    if (result.ok) {
      deployed.push(functionName);
    } else {
      failed.push(`${functionName}: ${result.stderr || result.stdout || 'failed'}`);
    }
  }

  return { deployed, failed };
}

async function fetchRestRows(apiUrl, serviceRoleKey, table, query) {
  const response = await fetch(`${apiUrl}/rest/v1/${table}?${query}`, {
    headers: buildSupabaseHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase rest query failed for ${table}: ${response.status} ${await response.text()}`,
    );
  }

  return response.json();
}

async function patchRestRows(apiUrl, serviceRoleKey, table, query, body) {
  const response = await fetch(`${apiUrl}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      ...buildSupabaseHeaders(serviceRoleKey),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase rest update failed for ${table}: ${response.status} ${await response.text()}`,
    );
  }

  return response.json();
}

async function listAuthUsers(apiUrl, serviceRoleKey) {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: buildSupabaseHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to list auth users: ${response.status} ${await response.text()}`,
    );
  }

  const payload = await response.json();
  return Array.isArray(payload?.users) ? payload.users : [];
}

async function ensureAuthUser(apiUrl, serviceRoleKey, fixture) {
  const createResponse = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: buildSupabaseHeaders(serviceRoleKey),
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      user_metadata: fixture.metadata,
    }),
  });

  if (createResponse.ok) {
    const payload = await createResponse.json();
    return payload.user ?? payload;
  }

  const body = await createResponse.text();
  if (!body.toLowerCase().includes('already')) {
    throw new Error(`Failed to create auth user ${fixture.email}: ${body}`);
  }

  const users = await listAuthUsers(apiUrl, serviceRoleKey);
  const existing = users.find(
    (user) => user.email?.toLowerCase() === fixture.email.toLowerCase(),
  );
  if (!existing) {
    throw new Error(
      `Auth user already existed for ${fixture.email} but could not be retrieved`,
    );
  }
  return existing;
}

async function syncSeededAccounts(apiUrl, serviceRoleKey, authUsers) {
  const rows = await fetchRestRows(
    apiUrl,
    serviceRoleKey,
    'accounts',
    'select=id,email,primary_role&order=created_at.asc',
  );

  const mutableRows = rows.filter(
    (row) => typeof row.email === 'string' && row.email.length > 0,
  );
  const roleToRows = new Map();
  for (const row of mutableRows) {
    const key = row.primary_role ?? 'unassigned';
    if (!roleToRows.has(key)) roleToRows.set(key, []);
    roleToRows.get(key).push(row);
  }

  const assignments = [];
  for (const fixture of PREVIEW_USERS) {
    const authUser = authUsers.find((entry) => entry.email === fixture.email);
    if (!authUser?.id) {
      throw new Error(`Missing auth user for fixture ${fixture.email}`);
    }

    const queue = roleToRows.get(fixture.role) ?? [];
    const account = queue.shift();
    if (!account?.id) {
      throw new Error(`Missing seeded account row for preview role ${fixture.role}`);
    }

    await patchRestRows(apiUrl, serviceRoleKey, 'accounts', `id=eq.${account.id}`, {
      email: fixture.email,
      auth_user_id: authUser.id,
      email_verified: true,
      email_verified_at: formatIsoNow(),
    });

    assignments.push({
      ...fixture,
      accountId: account.id,
      authUserId: authUser.id,
    });
  }

  return assignments;
}

async function uploadStorageFixture(apiUrl, serviceRoleKey, fixture) {
  const response = await fetch(
    `${apiUrl}/storage/v1/object/${fixture.bucket}/${encodeStoragePath(fixture.path)}`,
    {
      method: 'POST',
      headers: {
        ...buildSupabaseHeaders(serviceRoleKey, fixture.contentType),
        'x-upsert': 'true',
      },
      body: fixture.body,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Storage upload failed for ${fixture.bucket}/${fixture.path}: ${response.status} ${await response.text()}`,
    );
  }
}

async function uploadFixtures(apiUrl, serviceRoleKey) {
  const uploaded = [];
  const failed = [];

  for (const fixture of STORAGE_FIXTURES) {
    try {
      await uploadStorageFixture(apiUrl, serviceRoleKey, fixture);
      uploaded.push(`${fixture.bucket}/${fixture.path}`);
    } catch (error) {
      failed.push(toSummaryError(error));
    }
  }

  return { uploaded, failed };
}

async function syncVercelPreviewEnv({
  gitBranch,
  apiUrl,
  anonKey,
  publishableKey,
  serviceRoleKey,
  webUrl,
}) {
  const vercelToken = optionalEnv('VERCEL_TOKEN');
  const projectId = optionalEnv('VERCEL_PROJECT_ID');

  if (!vercelToken || !projectId) {
    return {
      synced: false,
      note: 'Skipped Vercel preview env sync because VERCEL_TOKEN or VERCEL_PROJECT_ID is not configured.',
      keys: [],
    };
  }

  const teamId = optionalEnv('VERCEL_TEAM_ID');
  const query = new URLSearchParams({ upsert: 'true' });
  if (teamId) query.set('teamId', teamId);

  const baseUrl = `https://api.vercel.com/v10/projects/${projectId}/env?${query.toString()}`;
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    INTERNAL_REMINDERS_TOKEN: requireEnv('INTERNAL_REMINDERS_TOKEN'),
    INTERNAL_ACTIVITY_FEED_TOKEN: requireEnv('INTERNAL_ACTIVITY_FEED_TOKEN'),
    INTERNAL_NOTIFICATIONS_TOKEN: requireEnv('INTERNAL_NOTIFICATIONS_TOKEN'),
  };

  if (webUrl) {
    values.NEXT_PUBLIC_APP_URL = webUrl;
  }

  const syncedKeys = [];
  for (const [key, value] of Object.entries(values)) {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: buildVercelHeaders(vercelToken),
      body: JSON.stringify({
        key,
        value,
        target: ['preview'],
        type: key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted',
        gitBranch,
        comment: `IconicEdu PR preview env for ${gitBranch}`,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to sync Vercel env ${key}: ${response.status} ${await response.text()}`,
      );
    }
    syncedKeys.push(key);
  }

  return { synced: true, note: null, keys: syncedKeys };
}

function buildNotificationsUrl(webUrl) {
  if (!webUrl) return null;
  return `${webUrl.replace(/\/$/, '')}/api/internal/notifications/dispatch`;
}

function buildPreviewSummary(input) {
  return {
    marker: 'iconicedu-preview-env',
    state: input.state,
    updatedAt: formatIsoNow(),
    prNumber: input.prNumber,
    gitBranch: input.gitBranch,
    previewBranchName: input.previewBranchName,
    webUrl: input.webUrl,
    supabase: input.supabase,
    vercel: input.vercel,
    expo: input.expo ?? {
      requested: false,
      triggered: false,
      status: 'not-requested',
      note: 'Add the `expo-preview` label to trigger an internal Expo preview build.',
    },
    errors: input.errors,
  };
}

async function resolveRootProjectRef() {
  const fromEnv = optionalEnv('SUPABASE_PROJECT_REF');
  if (fromEnv) {
    return fromEnv;
  }

  const candidateFiles = [
    'supabase/.temp/project-ref',
    'supabase/supabase/.temp/project-ref',
  ];
  for (const filePath of candidateFiles) {
    try {
      const value = (await readFile(filePath, 'utf8')).trim();
      if (value) {
        return value;
      }
    } catch {
      // Keep trying the next fallback.
    }
  }

  throw new Error(
    'Missing required Supabase project ref. Set SUPABASE_PROJECT_REF in GitHub secrets or ensure supabase/.temp/project-ref is available in CI.',
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prNumber = requireArg(args, 'pr');
  const gitBranch = requireArg(args, 'branch');
  const statusFile = args['status-file'] ?? DEFAULT_STATUS_FILE;
  const previewBranchName = buildPreviewBranchName(prNumber, gitBranch);
  const requestedWebUrl = normalizeUrl(
    args['web-url'] ?? optionalEnv('PREVIEW_WEB_URL') ?? '',
  );

  const errors = [];

  try {
    requireEnv('SUPABASE_ACCESS_TOKEN');
    const rootProjectRef = await resolveRootProjectRef();

    const initialBranch = await ensureSupabaseBranch(previewBranchName, rootProjectRef);
    const healthyBranch = await waitForHealthyBranch(previewBranchName, rootProjectRef);
    const branchProjectRef = findProjectRef(healthyBranch ?? initialBranch);
    const databaseBootstrap = await applyPreviewDatabaseBootstrap(branchProjectRef);
    const apiUrl = `https://${branchProjectRef}.supabase.co`;
    const dashboardUrl = dashboardUrlForProjectRef(branchProjectRef);
    const apiKeys = normalizeApiKeys(await getSupabaseApiKeys(branchProjectRef));

    const notificationsUrl = buildNotificationsUrl(requestedWebUrl);
    if (!notificationsUrl) {
      errors.push(
        'Preview web URL was not available during provisioning, so NOTIFICATIONS_DISPATCH_URL was not set. The notifications-dispatch edge function remains degraded until a preview URL is supplied.',
      );
    }

    const internalNotificationsToken = optionalEnv('INTERNAL_NOTIFICATIONS_TOKEN');
    if (!internalNotificationsToken) {
      errors.push(
        'INTERNAL_NOTIFICATIONS_TOKEN is not configured. notifications-dispatch will be deployed in degraded mode until the token is provided.',
      );
    }

    await setSupabaseSecrets(branchProjectRef, {
      SUPABASE_URL: apiUrl,
      SUPABASE_SERVICE_ROLE_KEY: apiKeys.serviceRoleKey,
      NOTIFICATIONS_DISPATCH_URL: notificationsUrl ?? '',
      INTERNAL_NOTIFICATIONS_TOKEN: internalNotificationsToken ?? '',
    });

    const edgeFunctions = await deployEdgeFunctions(branchProjectRef);

    const authUsers = [];
    for (const fixture of PREVIEW_USERS) {
      authUsers.push(await ensureAuthUser(apiUrl, apiKeys.serviceRoleKey, fixture));
    }
    const seededUsers = await syncSeededAccounts(
      apiUrl,
      apiKeys.serviceRoleKey,
      authUsers,
    );

    const storage = await uploadFixtures(apiUrl, apiKeys.serviceRoleKey);

    const vercel = await syncVercelPreviewEnv({
      gitBranch,
      apiUrl,
      anonKey: apiKeys.anonKey,
      publishableKey: apiKeys.publishableKey,
      serviceRoleKey: apiKeys.serviceRoleKey,
      webUrl: requestedWebUrl,
    });

    const googleAuthNote =
      'Preview automation seeds email/OTP auth. Google OAuth redirect registration still depends on shared provider configuration, so the workflow reports it as degraded until provider automation is confirmed.';

    const summary = buildPreviewSummary({
      state: 'active',
      prNumber,
      gitBranch,
      previewBranchName,
      webUrl: requestedWebUrl,
      supabase: {
        projectRef: branchProjectRef,
        rootProjectRef,
        databaseBootstrap,
        apiUrl,
        dashboardUrl,
        anonKey: apiKeys.anonKey,
        publishableKey: apiKeys.publishableKey,
        notificationsDispatchUrl: notificationsUrl,
        edgeFunctions,
        seededUsers,
        storage,
        notes: notificationsUrl
          ? internalNotificationsToken
            ? []
            : [
                'notifications-dispatch is missing INTERNAL_NOTIFICATIONS_TOKEN and remains degraded until that secret is configured.',
              ]
          : [
              'notifications-dispatch was deployed without NOTIFICATIONS_DISPATCH_URL because no preview web URL was available at provisioning time.',
            ],
        auth: {
          otpReady: true,
          googleOAuth: 'degraded',
          note: googleAuthNote,
        },
      },
      vercel,
      errors,
    });

    await writeJsonFile(statusFile, summary);
  } catch (error) {
    errors.push(toSummaryError(error));
    await writeJsonFile(
      statusFile,
      buildPreviewSummary({
        state: 'failed',
        prNumber,
        gitBranch,
        previewBranchName,
        webUrl: requestedWebUrl,
        supabase: null,
        vercel: null,
        errors,
      }),
    );
    throw error;
  }
}

await main();
