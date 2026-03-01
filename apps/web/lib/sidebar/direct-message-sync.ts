export function shouldAttemptDirectMessageSync(
  channelId: string,
  directMessageIds: Set<string>,
  excludedChannelIds: Set<string>,
) {
  return !directMessageIds.has(channelId) && !excludedChannelIds.has(channelId);
}
