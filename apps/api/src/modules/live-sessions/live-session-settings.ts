import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_LIVE_SESSION_SETTINGS,
  type LiveSessionSettingsVM,
} from '@iconicedu/shared-types';

/** Strict API validation; unknown keys and malformed booleans never become policy. */
export function parseLiveSessionSettings(value: unknown): LiveSessionSettingsVM {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid meeting settings');
  const result = structuredClone(DEFAULT_LIVE_SESSION_SETTINGS);
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(result, key))
      throw new BadRequestException(`Unknown meeting setting: ${key}`);
    const section = input[key];
    if (!section || typeof section !== 'object' || Array.isArray(section))
      throw new BadRequestException(`Invalid ${key} settings`);
    const target = result[key as keyof LiveSessionSettingsVM] as Record<string, boolean>;
    for (const [option, setting] of Object.entries(section)) {
      if (
        !Object.prototype.hasOwnProperty.call(target, option) ||
        typeof setting !== 'boolean'
      )
        throw new BadRequestException(`Invalid ${key}.${option}`);
      target[option] = setting;
    }
  }
  if (
    !result.recording.enabled &&
    (result.recording.autoStart || !result.recording.allowStop)
  )
    throw new BadRequestException(
      'Automatic recording and stop locking require recording to be enabled',
    );
  if (!result.messages.visible && result.messages.enabled)
    throw new BadRequestException('Enable Messages requires Show Messages');
  return result;
}

export function settingsFromSnapshot(
  metadata: Record<string, unknown> | null | undefined,
): LiveSessionSettingsVM {
  if (!metadata?.meetingSettings) return structuredClone(DEFAULT_LIVE_SESSION_SETTINGS);
  return parseLiveSessionSettings(metadata.meetingSettings);
}
