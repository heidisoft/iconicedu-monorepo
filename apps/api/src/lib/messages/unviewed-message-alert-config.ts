export const DEFAULT_UNVIEWED_MESSAGE_ALERT_THRESHOLD_HOURS = 4;
const MAX_UNVIEWED_MESSAGE_ALERT_THRESHOLD_HOURS = 24 * 7;

export function resolveUnviewedMessageAlertThresholdHours(
  rawValue = process.env.MESSAGE_UNVIEWED_CHECK_THRESHOLD_HOURS,
): number {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_UNVIEWED_MESSAGE_ALERT_THRESHOLD_HOURS;
  }

  return Math.min(
    MAX_UNVIEWED_MESSAGE_ALERT_THRESHOLD_HOURS,
    Math.max(1, Math.ceil(parsed)),
  );
}
