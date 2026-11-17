import { readFileSync } from 'node:fs';

export const entrySources = ['home', 'classroom', 'sessions'];

/** Live journeys intentionally use dedicated, operator-provisioned test classes. */
export function readClassroomE2EConfig(path) {
  if (!path)
    throw new Error('Set CLASSROOM_E2E_CONFIG to your private test configuration.');
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (config.dedicatedTestEnvironment !== true)
    throw new Error(
      'Confirm dedicatedTestEnvironment for live media and recording tests.',
    );
  const origin = new URL(config.webOrigin);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password
  )
    throw new Error('webOrigin must be an HTTP(S) origin without credentials.');
  if (origin.pathname !== '/' || origin.search || origin.hash)
    throw new Error('webOrigin must not contain a path, query or fragment.');
  if (!Array.isArray(config.journeys)) throw new Error('journeys must be an array.');
  const keys = new Set();
  for (const journey of config.journeys) {
    const key = `${journey.source}:${journey.scheduled}:${journey.existingSession}`;
    if (
      !entrySources.includes(journey.source) ||
      typeof journey.existingSession !== 'boolean' ||
      typeof journey.scheduled !== 'boolean'
    )
      throw new Error(
        'Each journey needs a source, scheduled and existingSession booleans.',
      );
    if (journey.source === 'sessions' && !journey.scheduled)
      throw new Error(
        'Unscheduled classes enter through home or classroom, not a scheduled-session card.',
      );
    if (keys.has(key)) throw new Error(`Duplicate journey: ${key}`);
    keys.add(key);
    for (const field of [
      'webPath',
      'joinSelector',
      'nativePath',
      'nativeJoinLabel',
      'displayName',
    ])
      if (typeof journey[field] !== 'string' || !journey[field].trim())
        throw new Error(`${key} requires ${field}.`);
    if (!journey.webPath.startsWith('/') || journey.webPath.startsWith('//'))
      throw new Error('webPath must be relative to webOrigin.');
    const url = new URL(journey.webPath, origin);
    if (url.origin !== origin.origin || url.hash || url.search)
      throw new Error('Entry URLs must not contain credentials, queries or fragments.');
    if (!journey.nativePath.startsWith('/') || /[?#]/.test(journey.nativePath))
      throw new Error('nativePath must be a route without queries or fragments.');
  }
  for (const source of entrySources)
    for (const scheduled of source === 'sessions' ? [true] : [true, false])
      for (const existing of [true, false])
        if (!keys.has(`${source}:${scheduled}:${existing}`))
          throw new Error(
            `Missing ${source} journey with scheduled=${scheduled}, existingSession=${existing}.`,
          );
  return config;
}
