import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function required(env, name) {
  if (!env[name]) throw new Error(`Missing ${name} for production URL discovery.`);
  return env[name];
}

function origin(value, name) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }
    return url.origin;
  } catch {
    throw new Error(
      `${name} must be an HTTPS origin without credentials, a path, or query.`,
    );
  }
}

export async function resolveMobileProductionUrls(env, request = fetch) {
  async function json(url, options, provider) {
    let response;
    try {
      response = await request(url, { ...options, signal: AbortSignal.timeout(30_000) });
    } catch {
      throw new Error(
        `${provider} URL discovery request failed. Check connectivity or configure production API_URL and WEB_URL.`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `${provider} URL discovery failed (HTTP ${response.status}). Check its token and project configuration or configure production API_URL and WEB_URL.`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`${provider} URL discovery returned invalid JSON.`);
    }
  }

  let apiUrl = env.API_URL;
  if (!apiUrl) {
    const token = required(env, 'RAILWAY_API_TOKEN');
    const projectId = required(env, 'RAILWAY_PROJECT_ID');
    async function railway(query, variables) {
      const result = await json(
        'https://backboard.railway.com/graphql/v2',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        },
        'Railway',
      );
      if (result.errors?.length) {
        // Do not print provider payloads, which may contain sensitive values.
        throw new Error(
          'Railway URL discovery returned GraphQL errors. Check token/project access or configure production API_URL.',
        );
      }
      return result.data;
    }
    const project = await railway(
      'query project($id: String!) { project(id: $id) { services { edges { node { id name } } } environments { edges { node { id name } } } } }',
      { id: projectId },
    );
    const environmentId = project?.project?.environments?.edges?.find(
      ({ node }) => node.name === 'production',
    )?.node.id;
    const serviceId =
      env.RAILWAY_SERVICE_ID ||
      project?.project?.services?.edges?.find(
        ({ node }) => node.name === env.REPOSITORY_NAME,
      )?.node.id;
    if (!environmentId || !serviceId) {
      throw new Error(
        'Railway production environment or service not found. Check RAILWAY_SERVICE_ID or configure production API_URL.',
      );
    }
    const result = await railway(
      'query domains($projectId: String!, $environmentId: String!, $serviceId: String!) { domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) { serviceDomains { domain } customDomains { domain } } }',
      { projectId, environmentId, serviceId },
    );
    const host =
      result?.domains?.customDomains?.[0]?.domain ||
      result?.domains?.serviceDomains?.[0]?.domain;
    if (!host)
      throw new Error(
        'No Railway production domain found. Configure production API_URL.',
      );
    apiUrl = `https://${host}`;
  }
  apiUrl = origin(apiUrl, 'API_URL');

  let webUrl = env.WEB_URL;
  if (!webUrl) {
    const token = required(env, 'VERCEL_TOKEN');
    const projectId = required(env, 'VERCEL_PROJECT_ID');
    const orgId = required(env, 'VERCEL_ORG_ID');
    if (!/^(team_|user_)/.test(orgId))
      throw new Error('VERCEL_ORG_ID must start with team_ or user_.');
    const url = new URL('https://api.vercel.com/v6/deployments');
    url.search = new URLSearchParams({
      projectId,
      target: 'production',
      state: 'READY',
      limit: '1',
      'meta-githubCommitRef': 'main',
      ...(orgId.startsWith('team_') ? { teamId: orgId } : {}),
    }).toString();
    const result = await json(
      url,
      { headers: { Authorization: `Bearer ${token}` } },
      'Vercel',
    );
    const host = result.deployments?.[0]?.url;
    if (!host)
      throw new Error(
        'No ready Vercel production deployment found for main. Configure production WEB_URL.',
      );
    webUrl = host.startsWith('https://') ? host : `https://${host}`;
  }
  return { apiUrl, webUrl: origin(webUrl, 'WEB_URL') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { apiUrl, webUrl } = await resolveMobileProductionUrls(process.env);
    appendFileSync(
      required(process.env, 'GITHUB_OUTPUT'),
      `api_url=${apiUrl}\nweb_url=${webUrl}\n`,
    );
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
