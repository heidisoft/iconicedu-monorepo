export const ADMIN_TOOL_KINDS = [
  'events-dispatch',
  'reminders-dispatch',
  'session-completions-dispatch',
  'push-notifications-dispatch',
  'schedule-reconciliation-dispatch',
  'channel-read-state-repair',
  'reminder-jobs-reset',
] as const;

export type AdminToolKind = (typeof ADMIN_TOOL_KINDS)[number];

export type AdminToolsDispatchRequest = {
  orgId: string;
  kind: AdminToolKind;
  limit?: number;
  leaseSeconds?: number;
  leaseOwner?: string;
};

export type AdminToolsDispatchResponse = {
  success: boolean;
  status: number;
  message?: string;
  data: {
    kind: AdminToolKind;
    orgId: string;
    durationMs: number;
    result: Record<string, unknown>;
  };
};
