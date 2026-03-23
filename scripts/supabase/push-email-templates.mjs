import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  CONFIG_END_MARKER,
  CONFIG_START_MARKER,
  TEMPLATE_SPECS,
  normalizeText,
} from './email-template-specs.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const CONFIG_PATH = path.join(REPO_ROOT, 'supabase', 'config.toml');

function parseArgs(argv) {
  const options = {
    dryRun: false,
    projectRef: process.env.SUPABASE_PROJECT_REF ?? '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--project-ref') {
      options.projectRef = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--project-ref=')) {
      options.projectRef = arg.split('=', 2)[1] ?? '';
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function extractManagedConfigBlock(configText) {
  const startIndex = configText.indexOf(CONFIG_START_MARKER);
  const endIndex = configText.indexOf(CONFIG_END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      'Could not find the managed email template block in supabase/config.toml.',
    );
  }

  return configText.slice(startIndex + CONFIG_START_MARKER.length, endIndex).trim();
}

function unescapeTomlString(value) {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    throw new Error(`Expected a TOML string, received: ${value}`);
  }

  return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function parseManagedTemplateConfig(configText) {
  const block = extractManagedConfigBlock(configText);
  const parsedSections = new Map();
  let currentSection = null;

  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1);
      parsedSections.set(currentSection, {});
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      throw new Error(`Unsupported config line in managed block: ${line}`);
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    const section = parsedSections.get(currentSection);

    if (key === 'enabled') {
      section.enabled = value === 'true';
      continue;
    }

    if (key === 'subject') {
      section.subject = unescapeTomlString(value);
      continue;
    }

    if (key === 'content_path') {
      section.contentPath = unescapeTomlString(value);
      continue;
    }

    throw new Error(`Unsupported key in managed block: ${key}`);
  }

  const templates = [];

  for (const spec of TEMPLATE_SPECS) {
    const section = parsedSections.get(spec.section);
    if (!section) {
      continue;
    }

    if (!section.subject || !section.contentPath) {
      throw new Error(
        `Managed template section ${spec.section} is missing required keys.`,
      );
    }

    templates.push({
      ...spec,
      subject: section.subject,
      contentPath: section.contentPath,
      enabled:
        spec.enabledKey == null
          ? undefined
          : Boolean(section.enabled ?? spec.defaultEnabled ?? false),
    });
  }

  return templates;
}

async function loadLocalTemplates(configText) {
  const templates = parseManagedTemplateConfig(configText);

  return Promise.all(
    templates.map(async (template) => {
      const filePath = path.resolve(REPO_ROOT, template.contentPath);
      const content = await fs.readFile(filePath, 'utf8');

      return {
        ...template,
        filePath,
        content: normalizeText(content),
      };
    }),
  );
}

function buildAuthConfigPatch(templates) {
  const payload = {};

  for (const template of templates) {
    payload[template.subjectKey] = template.subject;
    payload[template.contentKey] = template.content;
    if (template.enabledKey != null) {
      payload[template.enabledKey] = Boolean(template.enabled);
    }
  }

  return payload;
}

async function pushTemplatesToHosted({ accessToken, projectRef, payload }) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to update Supabase auth config (${response.status}): ${body}`,
    );
  }
}

function printSummary({ projectRef, dryRun, templates }) {
  console.log(
    `${dryRun ? 'Dry run:' : 'Pushed:'} local Supabase email templates for project ${projectRef}`,
  );

  if (templates.length === 0) {
    console.log('No managed local email templates are configured. Nothing to push.');
    return;
  }

  console.log('Templates:');
  for (const template of templates) {
    const extra =
      template.kind === 'notification'
        ? ` [notification, enabled=${template.enabled ? 'true' : 'false'}]`
        : '';
    console.log(
      `- ${template.id} <- ${path.relative(REPO_ROOT, template.filePath)}${extra}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? '';

  if (!accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN is required.');
  }

  if (!options.projectRef) {
    throw new Error(
      'SUPABASE_PROJECT_REF is required. Pass it via env or --project-ref.',
    );
  }

  const configText = await fs.readFile(CONFIG_PATH, 'utf8');
  const templates = await loadLocalTemplates(configText);

  printSummary({
    projectRef: options.projectRef,
    dryRun: options.dryRun,
    templates,
  });

  if (options.dryRun || templates.length === 0) {
    if (options.dryRun) {
      console.log('No hosted changes were written.');
    }
    return;
  }

  await pushTemplatesToHosted({
    accessToken,
    projectRef: options.projectRef,
    payload: buildAuthConfigPatch(templates),
  });

  console.log('Hosted Supabase auth config updated from local git-tracked templates.');
}

const isMainModule =
  process.argv[1] != null &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export {
  buildAuthConfigPatch,
  extractManagedConfigBlock,
  loadLocalTemplates,
  parseArgs,
  parseManagedTemplateConfig,
  unescapeTomlString,
};
