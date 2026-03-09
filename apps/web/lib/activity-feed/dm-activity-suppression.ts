export const DM_ACTIVITY_SUPPRESSION_WINDOW_MS = 120_000;

export function isDmActivitySuppressionDebugEnabled() {
  const raw = process.env.DEBUG_DM_ACTIVITY_SUPPRESSION;
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function filterDmRecipientsByLastReadRecency(input: {
  candidateProfileIds: string[];
  profileLastReadAtById: Map<string, string | null | undefined>;
  now: string;
  suppressionWindowMs?: number;
}) {
  const nowTime = new Date(input.now).getTime();
  if (Number.isNaN(nowTime)) {
    return {
      emittedProfileIds: [...input.candidateProfileIds],
      suppressedProfileIds: [] as string[],
      cutoffIso: null as string | null,
    };
  }

  const suppressionWindowMs =
    input.suppressionWindowMs ?? DM_ACTIVITY_SUPPRESSION_WINDOW_MS;
  const cutoffTime = nowTime - suppressionWindowMs;
  const emittedProfileIds: string[] = [];
  const suppressedProfileIds: string[] = [];

  for (const profileId of input.candidateProfileIds) {
    const lastReadAt = input.profileLastReadAtById.get(profileId);
    if (!lastReadAt) {
      emittedProfileIds.push(profileId);
      continue;
    }

    const lastReadAtTime = new Date(lastReadAt).getTime();
    if (Number.isNaN(lastReadAtTime)) {
      emittedProfileIds.push(profileId);
      continue;
    }

    if (lastReadAtTime >= cutoffTime) {
      suppressedProfileIds.push(profileId);
      continue;
    }

    emittedProfileIds.push(profileId);
  }

  return {
    emittedProfileIds,
    suppressedProfileIds,
    cutoffIso: new Date(cutoffTime).toISOString(),
  };
}
