export function shouldAttemptDirectMessageSync(
  channelId: string,
  directMessageIds: Set<string>,
  excludedChannelIds: Set<string>,
) {
  return !directMessageIds.has(channelId) && !excludedChannelIds.has(channelId);
}

export function shouldRunDirectMessageSync(input: {
  channelId: string;
  directMessageIds: Set<string>;
  excludedChannelIds: Set<string>;
  allowExistingSync?: boolean;
}) {
  if (input.allowExistingSync) {
    return !input.excludedChannelIds.has(input.channelId);
  }

  return shouldAttemptDirectMessageSync(
    input.channelId,
    input.directMessageIds,
    input.excludedChannelIds,
  );
}
