import {
  buildPreviewBranchName,
  buildVercelHeaders,
  fetchJson,
  formatIsoNow,
  optionalEnv,
  parseArgs,
  requireArg,
  requireEnv,
  runCommand,
  writeJsonFile,
} from './utils.mjs';

const DEFAULT_STATUS_FILE = '.tmp/preview-status.json';

async function removeVercelBranchEnv(gitBranch) {
  const vercelToken = optionalEnv('VERCEL_TOKEN');
  const projectId = optionalEnv('VERCEL_PROJECT_ID');
  if (!vercelToken || !projectId) {
    return {
      removed: [],
      note: 'Skipped Vercel cleanup because VERCEL_TOKEN or VERCEL_PROJECT_ID is not configured.',
    };
  }

  const teamId = optionalEnv('VERCEL_TEAM_ID');
  const query = new URLSearchParams({ gitBranch });
  if (teamId) query.set('teamId', teamId);

  const envs = await fetchJson(
    `https://api.vercel.com/v10/projects/${projectId}/env?${query}`,
    {
      headers: buildVercelHeaders(vercelToken),
    },
  );

  const ids = (
    Array.isArray(envs) ? envs : Array.isArray(envs?.envs) ? envs.envs : [envs]
  )
    .map((entry) => entry?.id)
    .filter(Boolean);

  if (ids.length === 0) {
    return {
      removed: [],
      note: 'No branch-specific Vercel preview env vars were found.',
    };
  }

  const deleteQuery = new URLSearchParams();
  if (teamId) deleteQuery.set('teamId', teamId);

  await fetch(`https://api.vercel.com/v1/projects/${projectId}/env?${deleteQuery}`, {
    method: 'DELETE',
    headers: buildVercelHeaders(vercelToken),
    body: JSON.stringify({ ids }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `Failed to remove Vercel env vars: ${response.status} ${await response.text()}`,
      );
    }
  });

  return { removed: ids, note: null };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prNumber = requireArg(args, 'pr');
  const gitBranch = requireArg(args, 'branch');
  const statusFile = args['status-file'] ?? DEFAULT_STATUS_FILE;
  const projectRef = requireEnv('SUPABASE_PROJECT_REF');

  const previewBranchName = buildPreviewBranchName(prNumber, gitBranch);
  const deleteResult = await runCommand(
    'supabase',
    ['branches', 'delete', previewBranchName, '--project-ref', projectRef],
    { cwd: 'supabase', tolerateFailure: true },
  );

  const vercel = await removeVercelBranchEnv(gitBranch);

  await writeJsonFile(statusFile, {
    marker: 'iconicedu-preview-env',
    state: 'closed',
    updatedAt: formatIsoNow(),
    prNumber,
    gitBranch,
    previewBranchName,
    supabase: {
      deleted: deleteResult.ok,
      note: deleteResult.ok
        ? null
        : deleteResult.stderr || deleteResult.stdout || 'delete failed',
    },
    vercel,
    expo: {
      requested: false,
      triggered: false,
      status: 'not-requested',
      note: 'Expo preview builds are not torn down automatically.',
    },
    errors: [],
  });
}

await main();
