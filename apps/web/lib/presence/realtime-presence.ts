type PresenceMeta = {
  profile_id?: string;
};

type PresenceStateValue = PresenceMeta[] | { metas?: PresenceMeta[] } | null | undefined;

export function extractOnlineProfileIdsFromPresenceState(
  presenceState: Record<string, PresenceStateValue> | null | undefined,
): Set<string> {
  const profileIds = new Set<string>();
  if (!presenceState) {
    return profileIds;
  }

  Object.entries(presenceState).forEach(([key, value]) => {
    const metas = Array.isArray(value)
      ? value
      : Array.isArray(value?.metas)
        ? value.metas
        : [];

    if (!metas.length) {
      if (key) {
        profileIds.add(key);
      }
      return;
    }

    metas.forEach((meta) => {
      const profileId = meta?.profile_id?.trim();
      if (profileId) {
        profileIds.add(profileId);
      } else if (key) {
        profileIds.add(key);
      }
    });
  });

  return profileIds;
}
