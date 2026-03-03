import type {
  ActivityFeedItemVM,
  ActivityGroupKeyVM,
  ActivityImportanceVM,
  ActivityItemContentVM,
  ActivityVerbVM,
  InboxActionButtonVM,
  InboxLeadingVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';
import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

import { resolveRecipientsForActivityEvent } from '@iconicedu/web/lib/activity-feed/projector/recipient-resolution';

export type ActivityRenderResult = {
  verb: ActivityVerbVM;
  leading?: InboxLeadingVM;
  headline: ActivityItemContentVM['headline'];
  summary?: string;
  preview?: ActivityItemContentVM['preview'];
  actionButton?: InboxActionButtonVM;
  expandedContent?: string;
  metadata?: Record<string, unknown>;
};

export type ActivityEventDefinition = {
  eventType: string;
  tabKey: InboxTabKeyVM;
  importance?: ActivityImportanceVM;
  group?: {
    groupType: ActivityGroupKeyVM;
    collapseByDefault?: boolean;
    buildGroupKey: (event: ActivityEventRow) => string | null;
  } | null;
  resolveRecipients: (
    supabase: SupabaseServiceClient,
    event: ActivityEventRow,
  ) => Promise<string[]>;
  render: (event: ActivityEventRow) => ActivityRenderResult;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function paymentAction(payload: Record<string, unknown>): InboxActionButtonVM | undefined {
  const href = asOptionalString(payload.href);
  if (!href) return undefined;
  return {
    label: 'View payment',
    variant: 'default',
    href,
  };
}

const DEFAULT_RECIPIENTS: ActivityEventDefinition['resolveRecipients'] = async (supabase, event) =>
  resolveRecipientsForActivityEvent(supabase, event);

function className(payload: Record<string, unknown>) {
  return asString(payload.title, 'Class');
}

function sessionName(payload: Record<string, unknown>) {
  return asString(payload.title, 'Session');
}

export const ACTIVITY_EVENT_DEFINITIONS: Record<string, ActivityEventDefinition> = {
  'message.posted': {
    eventType: 'message.posted',
    tabKey: 'all',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const content = asString(payload.content);
      const mentionedProfileId = asOptionalString(payload.mentionedProfileId);
      const isMention = Boolean(mentionedProfileId);
      return {
        verb: 'message.posted',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
        headline: {
          primary: isMention ? `${senderName} mentioned you` : `${senderName} sent a message`,
        },
        summary: content,
        preview: content ? { text: content.slice(0, 160) } : undefined,
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          ...(mentionedProfileId ? { mentionedProfileId } : {}),
          ...(isMention ? { notificationKey: 'messages.mentions' } : {}),
        },
      };
    },
  },
  'file.uploaded': {
    eventType: 'file.uploaded',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const name = asString(payload.name, 'File');
      const content = asOptionalString(payload.content);
      const fileCount =
        typeof payload.fileCount === 'number' && Number.isFinite(payload.fileCount)
          ? payload.fileCount
          : null;
      return {
        verb: 'file.uploaded',
        leading: { kind: 'icon', iconKey: 'FileText', tone: 'info' },
        headline: {
          primary: fileCount && fileCount > 1 ? `${fileCount} files uploaded` : 'File uploaded',
          secondary: fileCount && fileCount > 1 ? undefined : name,
        },
        summary: content ?? (fileCount && fileCount > 1 ? name : undefined),
        preview: content ? { text: content.slice(0, 160) } : undefined,
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          storagePath: payload.storagePath,
          mimeType: payload.mimeType,
          fileCount,
        },
      };
    },
  },
  'class.created': {
    eventType: 'class.created',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'class.created',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'info' },
        headline: { primary: 'Class created', secondary: className(payload) },
        summary: asOptionalString(payload.subject),
      };
    },
  },
  'class.updated': {
    eventType: 'class.updated',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'class.updated',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'neutral' },
        headline: { primary: 'Class updated', secondary: className(payload) },
        summary: asOptionalString(payload.changeSummary) ?? asOptionalString(payload.subject),
      };
    },
  },
  'class.archived': {
    eventType: 'class.archived',
    tabKey: 'classes',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'class.archived',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'warning' },
        headline: { primary: 'Class archived', secondary: className(payload) },
      };
    },
  },
  'member.invited': {
    eventType: 'member.invited',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'member.invited',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'info' },
        headline: {
          primary: 'Member invited',
          secondary: asString(payload.memberDisplayName, 'New member'),
        },
        summary: asOptionalString(payload.role),
      };
    },
  },
  'member.joined': {
    eventType: 'member.joined',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'member.joined',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'success' },
        headline: {
          primary: 'Member joined',
          secondary: asString(payload.memberDisplayName, 'New member'),
        },
        summary: asOptionalString(payload.role),
      };
    },
  },
  'member.removed': {
    eventType: 'member.removed',
    tabKey: 'classes',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'member.removed',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'warning' },
        headline: {
          primary: 'Member removed',
          secondary: asString(payload.memberDisplayName, 'Member'),
        },
      };
    },
  },
  'role.changed': {
    eventType: 'role.changed',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'role.changed',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'info' },
        headline: {
          primary: 'Role changed',
          secondary: asString(payload.memberDisplayName, 'Member'),
        },
        summary: asOptionalString(payload.role),
      };
    },
  },
  'session.scheduled': {
    eventType: 'session.scheduled',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.scheduled',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'info' },
        headline: { primary: 'Session scheduled', secondary: sessionName(payload) },
        summary: asOptionalString(payload.startAt),
      };
    },
  },
  'session.rescheduled': {
    eventType: 'session.rescheduled',
    tabKey: 'classes',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.rescheduled',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'warning' },
        headline: { primary: 'Session rescheduled', secondary: sessionName(payload) },
        summary: asOptionalString(payload.startAt),
      };
    },
  },
  'session.canceled': {
    eventType: 'session.canceled',
    tabKey: 'classes',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.canceled',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'danger' },
        headline: { primary: 'Session canceled', secondary: sessionName(payload) },
      };
    },
  },
  'session.started': {
    eventType: 'session.started',
    tabKey: 'classes',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const joinPath = asOptionalString(payload.joinPath);
      return {
        verb: 'session.started',
        leading: { kind: 'icon', iconKey: 'Video', tone: 'success' },
        headline: { primary: 'Class started', secondary: sessionName(payload) },
        actionButton: joinPath
          ? {
              label: 'Join now',
              variant: 'default',
              href: joinPath,
            }
          : undefined,
      };
    },
  },
  'session.ended': {
    eventType: 'session.ended',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.ended',
        leading: { kind: 'icon', iconKey: 'Video', tone: 'neutral' },
        headline: { primary: 'Class ended', secondary: sessionName(payload) },
      };
    },
  },
  'session.completed': {
    eventType: 'session.completed',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.completed',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'success' },
        headline: { primary: 'Session completed', secondary: sessionName(payload) },
      };
    },
  },
  'payment.reminder': {
    eventType: 'payment.reminder',
    tabKey: 'payment',
    importance: 'important',
    group: {
      groupType: 'payment',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return asOptionalString(payload.invoiceId) ?? null;
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'payment.reminder',
        leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'warning' },
        headline: { primary: 'Payment reminder' },
        summary: asOptionalString(payload.description),
        actionButton: paymentAction(payload),
      };
    },
  },
  'payment.received': {
    eventType: 'payment.received',
    tabKey: 'payment',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'payment.received',
        leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'success' },
        headline: { primary: 'Payment received' },
        summary: asOptionalString(payload.description),
        actionButton: paymentAction(payload),
      };
    },
  },
  'payment.failed': {
    eventType: 'payment.failed',
    tabKey: 'payment',
    importance: 'urgent',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'payment.failed',
        leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'danger' },
        headline: { primary: 'Payment failed' },
        summary: asOptionalString(payload.description),
        actionButton: paymentAction(payload),
      };
    },
  },
  'system.notice': {
    eventType: 'system.notice',
    tabKey: 'system',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const href = asOptionalString(payload.href);
      const actionLabel = asOptionalString(payload.actionLabel);
      return {
        verb: 'system.notice',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: { primary: asString(payload.title, 'System notice') },
        summary: asOptionalString(payload.message),
        actionButton:
          href && actionLabel
            ? {
                label: actionLabel,
                variant: 'default',
                href,
              }
            : undefined,
      };
    },
  },
};

export function getActivityEventDefinition(eventType: string) {
  return ACTIVITY_EVENT_DEFINITIONS[eventType];
}
