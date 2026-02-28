import type {
  AttachmentVM,
  ChannelFileItemVM,
  ChannelFileKind,
  ChannelFileRow,
  ChannelMediaItemVM,
  ChannelMediaRow,
  DesignFileUpdateMessageVM,
  DesignFileAttachmentVM,
  FileAttachmentVM,
  HomeworkSubmissionMessageVM,
  ImageAttachmentVM,
  LessonAssignmentMessageVM,
  MessageCoreVM,
  MessageMentionVM,
  MessageRow,
  MessageSocialVM,
  MessageStateVM,
  MessageVisibilityVM,
  MessageVM,
  MessageTypeVM,
  PaymentReminderMessageVM,
  ReactionVM,
  SessionBookingMessageVM,
  SessionSummaryMessageVM,
  ThreadVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

type MessageMapperInput = {
  sender: UserProfileVM;
  payload?: Record<string, unknown> | null;
  thread?: ThreadVM;
  reactions?: ReactionVM[];
};

function mapVisibility(row: MessageRow): MessageVisibilityVM {
  switch (row.visibility_type) {
    case 'sender-only':
      return { type: 'sender-only' };
    case 'recipient-only':
      return row.visibility_user_id
        ? { type: 'recipient-only', userId: row.visibility_user_id }
        : { type: 'sender-only' };
    case 'specific-users':
      return { type: 'specific-users', userIds: row.visibility_user_ids ?? [] };
    default:
      return { type: 'all' };
  }
}

function mapState(row: MessageRow): MessageStateVM | undefined {
  if (
    row.is_edited === null &&
    row.is_saved === null &&
    row.is_hidden === null &&
    !row.edited_at
  ) {
    return undefined;
  }

  return {
    isEdited: row.is_edited ?? undefined,
    editedAt: row.edited_at ?? undefined,
    isSaved: row.is_saved ?? undefined,
    isHidden: row.is_hidden ?? undefined,
  };
}

function mapAttachment(payload: Record<string, unknown> | null, type: MessageTypeVM) {
  const data = payload ?? {};
  if (type === 'image') {
    return {
      type: 'image',
      url: String(data.url ?? ''),
      storagePath: typeof data.storagePath === 'string' ? data.storagePath : undefined,
      name: String(data.name ?? 'image'),
      width: typeof data.width === 'number' ? data.width : undefined,
      height: typeof data.height === 'number' ? data.height : undefined,
    } satisfies ImageAttachmentVM;
  }
  if (type === 'file') {
    return {
      type: 'file',
      url: String(data.url ?? ''),
      storagePath: typeof data.storagePath === 'string' ? data.storagePath : undefined,
      name: String(data.name ?? 'file'),
      size: typeof data.size === 'number' ? data.size : undefined,
      mimeType: typeof data.mimeType === 'string' ? data.mimeType : undefined,
    } satisfies FileAttachmentVM;
  }
  return {
    type: 'design-file',
    url: String(data.url ?? ''),
    name: String(data.name ?? 'design-file'),
    tool: (data.tool as DesignFileAttachmentVM['tool']) ?? 'other',
    version: typeof data.version === 'string' ? data.version : undefined,
    lastModified: typeof data.lastModified === 'string' ? data.lastModified : undefined,
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : undefined,
  } satisfies DesignFileAttachmentVM;
}

function mapFileAttachments(
  payload: Record<string, unknown> | null,
  type: 'image' | 'file',
) {
  const attachments = payload?.attachments;
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [mapAttachment(payload, type)];
  }

  return attachments.map((attachment) =>
    mapAttachment(attachment as Record<string, unknown>, type),
  );
}

function mapAttachments(
  payload: Record<string, unknown> | null,
): AttachmentVM[] | undefined {
  const attachments = payload?.attachments;
  if (!Array.isArray(attachments)) {
    return undefined;
  }
  return attachments as AttachmentVM[];
}

export function mapMessageRowToVM(
  row: MessageRow,
  input: MessageMapperInput,
): MessageVM {
  const type = row.type as MessageTypeVM;
  const payload = input.payload ?? null;
  const core: MessageCoreVM = {
    type,
    sender: input.sender,
    createdAt: row.created_at,
    visibility: mapVisibility(row),
  };

  const social: MessageSocialVM = {
    reactions: input.reactions ?? [],
    ...(input.thread ? { thread: input.thread } : {}),
  };

  const base = {
    ids: { id: row.id, orgId: row.org_id },
    core,
    social,
    state: mapState(row),
  };

  switch (type) {
    case 'text':
      return {
        ...base,
        core: { ...core, type: 'text' },
        content: {
          text: String(payload?.text ?? ''),
          mentions: Array.isArray(payload?.mentions)
            ? (payload.mentions as MessageMentionVM[])
            : undefined,
        },
      };
    case 'image':
      {
        const attachments = mapFileAttachments(payload, type) as ImageAttachmentVM[];
      return {
        ...base,
        core: { ...core, type: 'image' },
        content: payload?.text ? { text: String(payload.text) } : undefined,
        attachment: attachments[0],
        attachments,
      };
      }
    case 'file':
      {
        const attachments = mapFileAttachments(payload, type) as FileAttachmentVM[];
      return {
        ...base,
        core: { ...core, type: 'file' },
        content: payload?.text ? { text: String(payload.text) } : undefined,
        attachment: attachments[0],
        attachments,
      };
      }
    case 'design-file-update':
      return {
        ...base,
        core: { ...core, type: 'design-file-update' },
        content: payload?.text ? { text: String(payload.text) } : undefined,
        attachment: mapAttachment(payload, type) as DesignFileAttachmentVM,
        diff: payload?.diff as DesignFileUpdateMessageVM['diff'],
      } as MessageVM;
    case 'payment-reminder':
      return {
        ...base,
        core: { ...core, type: 'payment-reminder' },
        content: { text: String(payload?.text ?? '') },
        payment: {
          amount: Number(payload?.amount ?? 0),
          currency: String(payload?.currency ?? 'USD'),
          dueAt: String(payload?.dueAt ?? row.created_at),
          status: (payload?.status as PaymentReminderMessageVM['payment']['status']) ?? 'pending',
          invoiceId: typeof payload?.invoiceId === 'string' ? payload.invoiceId : undefined,
          description: typeof payload?.description === 'string' ? payload.description : undefined,
        },
      } as MessageVM;
    case 'event-reminder':
      return {
        ...base,
        core: { ...core, type: 'event-reminder' },
        content: { text: String(payload?.text ?? '') },
        event: {
          status: typeof payload?.status === 'string' ? payload.status : undefined,
          title: String(payload?.title ?? ''),
          startAt: String(payload?.startAt ?? row.created_at),
          endAt: payload?.endAt ? String(payload.endAt) : undefined,
          location: typeof payload?.location === 'string' ? payload.location : undefined,
          meetingLink: typeof payload?.meetingLink === 'string' ? payload.meetingLink : undefined,
          attendees: payload?.attendees as UserProfileVM[] | undefined,
          isAllDay: typeof payload?.isAllDay === 'boolean' ? payload.isAllDay : undefined,
        },
      } as MessageVM;
    case 'feedback-request':
      return {
        ...base,
        core: { ...core, type: 'feedback-request' },
        content: payload?.text ? { text: String(payload.text) } : undefined,
        feedback: {
          prompt: String(payload?.prompt ?? ''),
          sessionTitle: (payload?.sessionTitle as string | null) ?? null,
          submittedAt: (payload?.submittedAt as string | null) ?? null,
          rating: (payload?.rating as number | null) ?? null,
          comment: (payload?.comment as string | null) ?? null,
        },
      } as MessageVM;
    case 'lesson-assignment':
      return {
        ...base,
        core: { ...core, type: 'lesson-assignment' },
        content: { text: String(payload?.text ?? '') },
        assignment: {
          title: String(payload?.title ?? ''),
          description: String(payload?.description ?? ''),
          dueAt: String(payload?.dueAt ?? row.created_at),
          subject: String(payload?.subject ?? ''),
          attachments: mapAttachments(payload),
          estimatedDuration:
            typeof payload?.estimatedDuration === 'number'
              ? payload.estimatedDuration
              : undefined,
          difficulty: payload?.difficulty as LessonAssignmentMessageVM['assignment']['difficulty'],
        },
      } as MessageVM;
    case 'progress-update':
      return {
        ...base,
        core: { ...core, type: 'progress-update' },
        content: { text: String(payload?.text ?? '') },
        progress: {
          subject: String(payload?.subject ?? ''),
          metric: String(payload?.metric ?? ''),
          previousValue: Number(payload?.previousValue ?? 0),
          currentValue: Number(payload?.currentValue ?? 0),
          targetValue:
            typeof payload?.targetValue === 'number' ? payload.targetValue : undefined,
          improvement: Number(payload?.improvement ?? 0),
          summary: String(payload?.summary ?? ''),
        },
      } as MessageVM;
    case 'session-booking':
      return {
        ...base,
        core: { ...core, type: 'session-booking' },
        content: { text: String(payload?.text ?? '') },
        session: {
          title: String(payload?.title ?? ''),
          subject: String(payload?.subject ?? ''),
          startAt: String(payload?.startAt ?? row.created_at),
          endAt: payload?.endAt ? String(payload.endAt) : undefined,
          durationMinutes: Number(payload?.durationMinutes ?? 0),
          meetingLink: typeof payload?.meetingLink === 'string' ? payload.meetingLink : undefined,
          location: typeof payload?.location === 'string' ? payload.location : undefined,
          status:
            (payload?.status as SessionBookingMessageVM['session']['status']) ??
            'scheduled',
          topics: Array.isArray(payload?.topics) ? (payload.topics as string[]) : undefined,
        },
      } as MessageVM;
    case 'session-complete':
      return {
        ...base,
        core: { ...core, type: 'session-complete' },
        content: payload?.text ? { text: String(payload.text) } : undefined,
        session: {
          title: String(payload?.title ?? ''),
          startAt: String(payload?.startAt ?? row.created_at),
          endAt: payload?.endAt ? String(payload.endAt) : undefined,
          completedAt: (payload?.completedAt as string | null) ?? null,
        },
      } as MessageVM;
    case 'session-summary':
      return {
        ...base,
        core: { ...core, type: 'session-summary' },
        content: payload?.text ? { text: String(payload.text) } : undefined,
        session: {
          title: String(payload?.title ?? ''),
          startAt: String(payload?.startAt ?? row.created_at),
          durationMinutes:
            typeof payload?.durationMinutes === 'number'
              ? payload.durationMinutes
              : undefined,
          summary: String(payload?.summary ?? ''),
          highlights: Array.isArray(payload?.highlights)
            ? (payload.highlights as string[])
            : undefined,
          nextSteps: Array.isArray(payload?.nextSteps)
            ? (payload.nextSteps as string[])
            : undefined,
        },
      } as MessageVM;
    case 'homework-submission':
      return {
        ...base,
        core: { ...core, type: 'homework-submission' },
        content: { text: String(payload?.text ?? '') },
        homework: {
          assignmentTitle: String(payload?.assignmentTitle ?? ''),
          submittedAt: String(payload?.submittedAt ?? row.created_at),
          attachments: mapAttachments(payload) ?? [],
          status:
            (payload?.status as HomeworkSubmissionMessageVM['homework']['status']) ??
            'submitted',
          grade: typeof payload?.grade === 'string' ? payload.grade : undefined,
          feedback: typeof payload?.feedback === 'string' ? payload.feedback : undefined,
        },
      } as MessageVM;
    case 'link-preview':
      return {
        ...base,
        core: { ...core, type: 'link-preview' },
        content: payload?.text
          ? {
              text: String(payload.text),
              mentions: Array.isArray(payload?.mentions)
                ? (payload.mentions as MessageMentionVM[])
                : undefined,
            }
          : undefined,
        link: {
          url: String(payload?.url ?? ''),
          title: String(payload?.title ?? ''),
          description: typeof payload?.description === 'string' ? payload.description : undefined,
          imageUrl: typeof payload?.imageUrl === 'string' ? payload.imageUrl : undefined,
          siteName: typeof payload?.siteName === 'string' ? payload.siteName : undefined,
          favicon: typeof payload?.favicon === 'string' ? payload.favicon : undefined,
        },
      } as MessageVM;
    case 'audio-recording':
      return {
        ...base,
        core: { ...core, type: 'audio-recording' },
        content: payload?.text ? { text: String(payload.text) } : undefined,
        audio: {
          url: String(payload?.url ?? ''),
          storagePath: typeof payload?.storagePath === 'string' ? payload.storagePath : undefined,
          durationSeconds: Number(payload?.durationSeconds ?? 0),
          waveform: Array.isArray(payload?.waveform)
            ? (payload.waveform as number[])
            : undefined,
          fileSize: typeof payload?.fileSize === 'number' ? payload.fileSize : undefined,
          mimeType: typeof payload?.mimeType === 'string' ? payload.mimeType : undefined,
        },
      } as MessageVM;
    default:
      return {
        ...base,
        core: { ...core, type: 'text' },
        content: { text: String(payload?.text ?? '') },
      };
  }
}

export function mapChannelFileRow(
  row: ChannelFileRow,
  options: { resolvedUrl?: string } = {},
): ChannelFileItemVM {
  return {
    ids: { id: row.id, orgId: row.org_id, channelId: row.channel_id },
    messageId: row.message_id ?? undefined,
    senderId: row.sender_profile_id ?? undefined,
    kind: (row.kind ?? 'file') as ChannelFileKind,
    url: options.resolvedUrl ?? row.url,
    storagePath: row.url,
    name: row.name,
    mimeType: row.mime_type ?? undefined,
    size: row.size ?? undefined,
    tool: row.tool ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapChannelMediaRow(row: ChannelMediaRow): ChannelMediaItemVM {
  return {
    ids: { id: row.id, orgId: row.org_id, channelId: row.channel_id },
    messageId: row.message_id ?? undefined,
    senderId: row.sender_profile_id ?? undefined,
    type: row.type as ChannelMediaItemVM['type'],
    url: row.url,
    name: row.name ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    createdAt: row.created_at,
  };
}
