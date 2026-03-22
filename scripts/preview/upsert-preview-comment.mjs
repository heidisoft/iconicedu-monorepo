import { PREVIEW_COMMENT_MARKER } from './fixtures.mjs';
import {
  buildGitHubHeaders,
  fetchJson,
  parseArgs,
  readJsonFile,
  requireArg,
} from './utils.mjs';

const DEFAULT_STATUS_FILE = '.tmp/preview-status.json';

function renderUsers(users = []) {
  if (users.length === 0) return '- None';
  return users
    .map(
      (user) =>
        `- ${user.label}: \`${user.email}\` / \`${user.password}\` (${user.role})`,
    )
    .join('\n');
}

function renderList(items = []) {
  if (!items || items.length === 0) return '- None';
  return items.map((item) => `- ${item}`).join('\n');
}

function renderComment(summary) {
  const errors = summary.errors?.length
    ? `\n**Errors**\n${renderList(summary.errors)}\n`
    : '';

  if (summary.state === 'closed') {
    return `${PREVIEW_COMMENT_MARKER}
## Preview Environment

Preview environment closed for \`${summary.gitBranch}\`.

- Supabase branch: \`${summary.previewBranchName}\`
- Supabase teardown: ${summary.supabase?.deleted ? 'completed' : 'check workflow logs'}
- Vercel env cleanup: ${summary.vercel?.removed?.length ? `${summary.vercel.removed.length} variable(s) removed` : (summary.vercel?.note ?? 'not run')}

Updated: ${summary.updatedAt}
${errors}`.trim();
  }

  return `${PREVIEW_COMMENT_MARKER}
## Preview Environment

- State: **${summary.state}**
- Git branch: \`${summary.gitBranch}\`
- Supabase preview branch: \`${summary.previewBranchName}\`
- Supabase dashboard: ${summary.supabase?.dashboardUrl ?? 'Pending'}
- Supabase API URL: ${summary.supabase?.apiUrl ?? 'Pending'}
- Web preview URL: ${summary.webUrl ?? 'Waiting for Vercel preview URL'}
- Expo preview: ${summary.expo?.status ?? 'not-requested'}

**Seeded test users**
${renderUsers(summary.supabase?.seededUsers)}

**Edge functions**
${renderList(summary.supabase?.edgeFunctions?.deployed)}

${summary.supabase?.edgeFunctions?.failed?.length ? `**Edge function failures**\n${renderList(summary.supabase.edgeFunctions.failed)}\n` : ''}

**Storage fixtures**
${renderList(summary.supabase?.storage?.uploaded)}

**Auth**
- OTP/email login: ${summary.supabase?.auth?.otpReady ? 'ready' : 'not configured'}
- Google OAuth: ${summary.supabase?.auth?.googleOAuth ?? 'unknown'}
- Note: ${summary.supabase?.auth?.note ?? 'No auth note recorded.'}

**Vercel preview env sync**
${summary.vercel?.synced ? renderList(summary.vercel.keys) : `- ${summary.vercel?.note ?? 'Not run'}`}

**Expo preview build**
${summary.expo?.urls?.length ? renderList(summary.expo.urls) : `- ${summary.expo?.note ?? 'Add the \`expo-preview\` label to trigger a build.'}`}

Updated: ${summary.updatedAt}
${errors}`.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prNumber = requireArg(args, 'pr');
  const statusFile = args['status-file'] ?? DEFAULT_STATUS_FILE;
  const summary = await readJsonFile(statusFile);

  const token = process.env.GITHUB_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();

  if (!token || !repository) {
    throw new Error(
      'GITHUB_TOKEN and GITHUB_REPOSITORY are required to update PR preview comments',
    );
  }

  const headers = buildGitHubHeaders(token);
  const comments = await fetchJson(
    `https://api.github.com/repos/${repository}/issues/${prNumber}/comments`,
    { headers },
  );

  const body = renderComment(summary);
  const existing = comments.find((comment) =>
    comment.body?.includes(PREVIEW_COMMENT_MARKER),
  );

  if (existing?.id) {
    await fetch(
      `https://api.github.com/repos/${repository}/issues/comments/${existing.id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ body }),
      },
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to update preview comment: ${response.status} ${await response.text()}`,
        );
      }
    });
    return;
  }

  await fetch(`https://api.github.com/repos/${repository}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `Failed to create preview comment: ${response.status} ${await response.text()}`,
      );
    }
  });
}

await main();
