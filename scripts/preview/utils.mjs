import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith('--')) continue;

    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export function requireArg(args, key) {
  const value = args[key];
  if (!value?.trim()) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value.trim();
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function slugifyBranch(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 42);
}

export function buildPreviewBranchName(prNumber, gitBranch) {
  const suffix = slugifyBranch(gitBranch) || 'branch';
  return `pr-${prNumber}-${suffix}`.slice(0, 63);
}

export async function runCommand(command, args, options = {}) {
  const { cwd, env, tolerateFailure = false } = options;
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      ok: true,
      stdout: result.stdout?.trim() ?? '',
      stderr: result.stderr?.trim() ?? '',
      exitCode: 0,
    };
  } catch (error) {
    if (!tolerateFailure) {
      throw new Error(
        [
          `Command failed: ${command} ${args.join(' ')}`,
          error.stdout?.trim(),
          error.stderr?.trim(),
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    return {
      ok: false,
      stdout: error.stdout?.trim() ?? '',
      stderr: error.stderr?.trim() ?? '',
      exitCode: error.code ?? 1,
    };
  }
}

export async function runJsonCommand(command, args, options = {}) {
  const result = await runCommand(command, args, options);
  if (!result.stdout) {
    throw new Error(`Command returned no JSON output: ${command} ${args.join(' ')}`);
  }

  const normalized = extractJsonPayload(result.stdout);
  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from ${command} ${args.join(' ')}\n${result.stdout}\n${error}`,
    );
  }
}

function extractJsonPayload(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return trimmed;
  }

  const objectStart = trimmed.indexOf('{');
  const arrayStart = trimmed.indexOf('[');

  let start = -1;
  if (objectStart >= 0 && arrayStart >= 0) {
    start = Math.min(objectStart, arrayStart);
  } else if (objectStart >= 0) {
    start = objectStart;
  } else if (arrayStart >= 0) {
    start = arrayStart;
  }

  if (start === -1) {
    return trimmed;
  }

  return trimmed.slice(start);
}

export function pickFirstString(input, candidateKeys) {
  if (input == null) return null;
  if (typeof input === 'string') return null;

  if (Array.isArray(input)) {
    for (const item of input) {
      const match = pickFirstString(item, candidateKeys);
      if (match) return match;
    }
    return null;
  }

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && candidateKeys.includes(key)) {
      return value;
    }
    if (value && typeof value === 'object') {
      const match = pickFirstString(value, candidateKeys);
      if (match) return match;
    }
  }

  return null;
}

export function findProjectRef(input) {
  const direct = pickFirstString(input, ['project_ref', 'ref', 'projectRef']);
  if (direct && /^[a-z0-9]{20}$/i.test(direct)) {
    return direct;
  }

  const queue = [input];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (typeof current === 'string' && /^[a-z0-9]{20}$/i.test(current)) {
      return current;
    }
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (typeof current === 'object') {
      queue.push(...Object.values(current));
    }
  }

  throw new Error('Could not determine Supabase branch project ref from CLI output');
}

export function normalizeUrl(value) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed.toString().replace(/\/$/, '');
}

export function dashboardUrlForProjectRef(projectRef) {
  return `https://supabase.com/dashboard/project/${projectRef}`;
}

export function formatIsoNow() {
  return new Date().toISOString();
}

export async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function writeJsonFile(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${response.statusText}\n${body}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export function buildGitHubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function buildVercelHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function buildSupabaseHeaders(serviceRoleKey, contentType = 'application/json') {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': contentType,
  };
}

export function encodeStoragePath(pathname) {
  return pathname
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function toSummaryError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
