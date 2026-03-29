'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageList,
  type MessageListRef,
} from '@iconicedu/ui-web/components/messages/message-list';
import { MessageInput } from '@iconicedu/ui-web/components/messages/message-input';
import { TypingIndicator } from '@iconicedu/ui-web/components/messages/typing-indicator';
import { useMessages } from '@iconicedu/ui-web/hooks/use-messages';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import type { MessageActionState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { resolveThreadAfterReply } from '@iconicedu/ui-web/components/messages/thread-reply.utils';
import { buildFileDownloadHref } from '@iconicedu/ui-web/components/messages/file-download.utils';
import { MessagesScheduleTab } from '@iconicedu/ui-web/components/messages/tabs/messages-schedule-tab';
import { MessagesMembersTab } from '@iconicedu/ui-web/components/messages/tabs/messages-members-tab';
import { MessagesSavedTab } from '@iconicedu/ui-web/components/messages/tabs/messages-saved-tab';
import {
  getMessagesContainerTabs,
  type MessagesContainerTabKey,
} from '@iconicedu/ui-web/components/messages/tabs/messages-container-tabs';
import {
  hashToTabKey,
  tabKeyToHash,
} from '@iconicedu/ui-web/components/messages/tabs/messages-container-tab-hash';
import { Tabs, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Button } from '@iconicedu/ui-web/ui/button';
import { EmptyMessagesState } from '@iconicedu/ui-web/components/messages/empty-state';
import {
  createChannelFileItems,
  formatChannelFileUploadedDate,
  getChannelFileVisualKind,
  getChannelFileVisualTone,
} from './messages-container-files.utils';
import { buildMessageActionState } from './message-loading-state.utils';
import type {
  AudioRecordingMessageVM,
  ChannelFileItemVM,
  ClassScheduleVM,
  ChannelVM,
  EducatorProfileVM,
  FileMessageVM,
  GuardianProfileVM,
  ImageMessageVM,
  ISODateTime,
  MessageVM,
  MessageMentionVM,
  MessagesRealtimeClient,
  MessageWriteClient,
  LessonAssignmentMessageVM,
  TextMessageVM,
  ThreadVM,
  UUID,
  UserProfileVM,
} from '@iconicedu/shared-types';
import {
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  GraduationCap,
  LifeBuoy,
  Loader2,
  Presentation,
} from 'lucide-react';
import { ScheduleDisplayTimeZoneProvider } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';

function getMessageInputPlaceholder(
  channel: ChannelVM,
  currentUserId: string | null,
): string {
  const { kind, topic } = channel.basics;
  const participants = channel.collections.participants;

  if (kind === 'dm') {
    // For direct messages, show the other person's name
    const otherPerson = participants.find((p) => p.ids.id !== currentUserId);
    if (otherPerson) {
      return `Message ${getProfileDisplayName(otherPerson.profile, 'User')}`;
    }
    return 'Message User';
  }

  if (kind === 'group_dm') {
    // For group DMs, show "this conversation"
    return 'Message this conversation';
  }

  // For channels, show the channel topic/name
  return `Message #${topic || 'channel'}`;
}

export interface MessagesContainerProps {
  channel: ChannelVM;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  readOnly?: boolean;
  showCreateMessageTypeButton?: boolean;
  realtimeClient?: MessagesRealtimeClient | null;
  messageWriteClient?: MessageWriteClient | null;
  uploadFileMessage?: (input: {
    attachments: Array<{ file: File; durationSeconds?: number }>;
    content?: string;
    threadId?: string | null;
    threadParentId?: string | null;
  }) => Promise<MessageVM[]>;
  joinLiveSession?: () => Promise<void>;
}

const isGuardianProfile = (profile: UserProfileVM): profile is GuardianProfileVM =>
  profile.kind === 'guardian';

const isEducatorProfile = (profile: UserProfileVM): profile is EducatorProfileVM =>
  profile.kind === 'educator';

function getParticipantShortName(
  profile?: UserProfileVM | null,
  fallback = 'Someone',
): string {
  const firstName = profile?.profile.firstName?.trim();
  if (firstName) {
    return firstName;
  }

  const displayName = getProfileDisplayName(profile?.profile, fallback).trim();
  const [firstToken] = displayName.split(/\s+/);
  return firstToken || fallback;
}

function formatCompactNames(names: string[]): string {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (uniqueNames.length === 0) return '';
  if (uniqueNames.length === 1) return uniqueNames[0]!;
  return `${uniqueNames[0]} +${uniqueNames.length - 1} more`;
}

function buildChannelEmptyStateCopy(input: {
  channel: ChannelVM;
  currentUserProfile: UserProfileVM | null;
  participants: UserProfileVM[];
}): EmptyStateCopy {
  const { channel, currentUserProfile, participants } = input;

  if (channel.basics.kind === 'dm') {
    const otherParticipant = participants.find(
      (participant) => participant.ids.id !== currentUserProfile?.ids.id,
    );
    const otherParticipantName = otherParticipant
      ? getProfileDisplayName(otherParticipant.profile, 'there')
      : 'there';

    return {
      title: `Say hello to ${otherParticipantName}!`,
      description:
        'This is a direct message conversation. Chat here whenever you want, keep replies respectful, and keep the conversation in one place.',
      starterAction: {
        label: 'Say hello',
        prefillText: `Hi ${otherParticipantName}, I wanted to reach out here.`,
      },
    };
  }

  if (channel.basics.purpose === 'support') {
    return {
      title: 'Talk to support here',
      description:
        'Use this support channel for payment questions, class scheduling issues, teacher, parent, or student concerns, and any other operational help. Our support staff will help you resolve the issue.',
      icon: <LifeBuoy className="size-5" />,
      starterAction: {
        label: 'Ask support for help',
        prefillText: 'Hi support team, I need help with ',
      },
    };
  }

  if (channel.basics.purpose === 'learning-space') {
    const educators = participants.filter(
      (participant) => participant.kind === 'educator',
    );
    const guardians = participants.filter(
      (participant) => participant.kind === 'guardian',
    );
    const students = participants.filter((participant) => participant.kind === 'child');

    const educatorName = educators[0]
      ? getParticipantShortName(educators[0], 'your teacher')
      : 'your teacher';
    const guardianNames = formatCompactNames(
      guardians.map((participant) => getParticipantShortName(participant, 'Parent')),
    );
    const studentNames = formatCompactNames(
      students.map((participant) => getParticipantShortName(participant, 'Student')),
    );

    if (currentUserProfile?.kind === 'educator') {
      const familyLabel =
        guardianNames && studentNames
          ? `${guardianNames} about ${studentNames}`
          : guardianNames || studentNames || 'families in this class';

      return {
        title: `Start the class conversation with ${familyLabel}`,
        description: `Use this class channel to communicate with ${familyLabel}. Share class updates, discuss reschedules or cancellations, and send homework or learning resources in one place.`,
        icon: <GraduationCap className="size-5" />,
        starterAction: {
          label: 'Start class update',
          prefillText: 'Hi everyone, sharing a quick update about class today.',
        },
      };
    }

    if (currentUserProfile?.kind === 'guardian') {
      return {
        title: `Say hello to ${educatorName}!`,
        description:
          'This class channel is for communicating with your teacher about the class, reschedules or cancellations, homework, and shared learning resources.',
        icon: <GraduationCap className="size-5" />,
        starterAction: {
          label: 'Message teacher',
          prefillText: `Hi ${educatorName}, I’m reaching out about ${channel.basics.topic}.`,
        },
      };
    }

    if (currentUserProfile?.kind === 'child') {
      return {
        title: `Say hello to ${educatorName}!`,
        description:
          'This class channel is for communicating with your teacher about class updates, schedule changes, homework, and shared learning resources.',
        icon: <GraduationCap className="size-5" />,
        starterAction: {
          label: 'Ask teacher',
          prefillText: `Hi ${educatorName}, I have a question about class.`,
        },
      };
    }

    return {
      title: 'Start the class conversation',
      description:
        'Use this class channel to communicate about the class, schedule changes, cancellations, homework, and shared learning resources.',
      icon: <GraduationCap className="size-5" />,
    };
  }

  return {
    title: 'No messages yet',
    description: 'Looks like you have not started a conversation yet.',
  };
}

const MESSAGES_PAGE_SIZE = 40;
const READ_STATE_PERSIST_DEBOUNCE_MS = 220;
const TYPING_REMOTE_TIMEOUT_MS = 4000;

type AssignmentSendInput = {
  kind?: 'homework' | 'lesson';
  title: string;
  description?: string;
  dueAt: string;
  subject?: string;
} | null;

type EmptyStateStarterAction = {
  label: string;
  prefillText: string;
};

type EmptyStateCopy = {
  title: string;
  description: string;
  icon?: ReactNode;
  starterAction?: EmptyStateStarterAction;
};

function formatFileSize(size?: number | null): string {
  if (!size || size <= 0) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function buildOptimisticComposerMessage(input: {
  orgId: string;
  sender: UserProfileVM;
  content: string;
  mentions?: MessageMentionVM[];
  homework?: AssignmentSendInput;
}): TextMessageVM | LessonAssignmentMessageVM {
  const now = new Date().toISOString();
  const trimmedContent = input.content.trim();
  const homework = input.homework;

  if (!homework) {
    return {
      ids: { id: `msg-${Date.now()}`, orgId: input.orgId },
      core: {
        type: 'text',
        sender: input.sender,
        createdAt: now,
        visibility: { type: 'all' },
      },
      social: {
        reactions: [],
      },
      state: {
        isSaved: false,
      },
      content: { text: input.content, mentions: input.mentions },
    };
  }

  const defaultTitle =
    homework.kind === 'lesson' ? 'Lesson assignment' : 'Homework assignment';

  return {
    ids: { id: `msg-${Date.now()}`, orgId: input.orgId },
    core: {
      type: 'lesson-assignment',
      sender: input.sender,
      createdAt: now,
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
    },
    state: {
      isSaved: false,
    },
    content: {
      text:
        trimmedContent ||
        `${homework.kind === 'lesson' ? 'Lesson' : 'Homework'} assignment posted.`,
      mentions: input.mentions,
    },
    assignment: {
      kind: homework.kind,
      title: homework.title.trim() || defaultTitle,
      description:
        homework.description?.trim() ||
        trimmedContent ||
        'Open this assignment to review details.',
      dueAt: homework.dueAt,
      subject: homework.subject?.trim() || 'General',
    },
  };
}

export function getDefaultMessagesTab(
  _channel: ChannelVM,
  _enableScheduleTab: boolean,
): MessagesContainerTabKey {
  return 'messages';
}

function getFilesTabIcon(item: ChannelFileItemVM) {
  const kind = getChannelFileVisualKind(item);

  switch (kind) {
    case 'image':
      return FileImage;
    case 'audio':
      return FileAudio;
    case 'pdf':
    case 'text':
      return FileText;
    case 'document':
      return FileType2;
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'presentation':
      return Presentation;
    case 'archive':
      return FileArchive;
    default:
      return FileText;
  }
}

export function MessagesContainer({
  channel,
  currentUserId: currentUserIdProp,
  currentUserProfile,
  readOnly = false,
  showCreateMessageTypeButton = true,
  realtimeClient,
  messageWriteClient,
  uploadFileMessage,
  joinLiveSession,
}: MessagesContainerProps) {
  const messageListRef = useRef<MessageListRef>(null);
  const messagesRef = useRef<MessageVM[]>([]);
  const lastPersistedReadMessageIdRef = useRef<UUID | null>(
    channel.collections.readState?.lastReadMessageId ?? null,
  );
  const pendingReadMessageIdRef = useRef<UUID | null>(null);
  const persistReadStateTimerRef = useRef<number | null>(null);
  const typingTimeoutsRef = useRef(new Map<string, number>());
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set());
  const [composerPrefillRequest, setComposerPrefillRequest] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const {
    toggle,
    setSavedCount,
    setHomeworkCount,
    setSessionSummaryCount,
    setThreadData,
    setCurrentUserId,
    setMessages,
    setCreateTextMessage,
    setSendTextMessage,
    setSendFileMessage,
    setJoinLiveSession,
    setThreadHandlers,
    setGetMessageActionState,
    setScrollToMessage,
    messageFilter,
    toggleMessageFilter,
  } = useMessagesState();
  const channelMessages = useMemo(
    () => channel.collections.messages?.items ?? [],
    [channel.collections.messages],
  );
  const {
    messages,
    addMessage,
    prependMessages,
    updateMessage,
    deleteMessage,
    toggleReaction,
    toggleSaved,
    toggleHidden,
  } = useMessages(channelMessages);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [savingMessageIds, setSavingMessageIds] = useState<Record<string, true>>({});
  const [hidingMessageIds, setHidingMessageIds] = useState<Record<string, true>>({});
  const [deletingMessageIds, setDeletingMessageIds] = useState<Record<string, true>>({});
  const [reactionPickerMessageIds, setReactionPickerMessageIds] = useState<
    Record<string, true>
  >({});
  const [reactionEmojiKeys, setReactionEmojiKeys] = useState<Record<string, true>>({});
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(
    channelMessages.length >= MESSAGES_PAGE_SIZE,
  );
  const [activeTab, setActiveTab] = useState<MessagesContainerTabKey>('messages');
  const [loadedFiles, setLoadedFiles] = useState<ChannelFileItemVM[] | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesLoadError, setFilesLoadError] = useState<string | null>(null);
  const [loadedSchedules, setLoadedSchedules] = useState<ClassScheduleVM[] | null>(null);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [schedulesLoadError, setSchedulesLoadError] = useState<string | null>(null);
  const pendingSavedNavigationMessageIdRef = useRef<string | null>(null);
  const [oldestCursor, setOldestCursor] = useState<string | null>(
    channelMessages[0]?.core.createdAt ?? null,
  );
  const [lastReadMessageId, setLastReadMessageId] = useState<UUID | undefined>(
    channel.collections.readState?.lastReadMessageId,
  );
  const [lastReadAt, setLastReadAt] = useState<ISODateTime | undefined>(
    channel.collections.readState?.lastReadAt,
  );
  const filesForDisplay = loadedFiles ?? [];
  const hasScheduleCapability = useMemo(
    () => channel.context?.capabilities?.includes('has_schedule') ?? false,
    [channel.context?.capabilities],
  );
  const enableScheduleTab = hasScheduleCapability || (loadedSchedules?.length ?? 0) > 0;
  const containerTabs = useMemo(
    () => getMessagesContainerTabs(enableScheduleTab, channel.ui?.disabledTabs ?? []),
    [enableScheduleTab, channel.ui?.disabledTabs],
  );
  const defaultTab = useMemo(
    () => getDefaultMessagesTab(channel, enableScheduleTab),
    [channel, enableScheduleTab],
  );

  const runWithNetworkActivity = useCallback(async <T,>(operation: () => Promise<T>) => {
    return await operation();
  }, []);

  const setPendingMessageAction = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Record<string, true>>>,
      key: string,
      pending: boolean,
    ) => {
      setter((current) => {
        if (pending) {
          return { ...current, [key]: true };
        }
        if (!current[key]) {
          return current;
        }
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const getMessageActionState = useCallback(
    (messageId: string): MessageActionState | undefined => {
      return buildMessageActionState(messageId, {
        savingMessageIds,
        hidingMessageIds,
        deletingMessageIds,
        reactionPickerMessageIds,
        reactionEmojiKeys,
      });
    },
    [
      deletingMessageIds,
      hidingMessageIds,
      reactionEmojiKeys,
      reactionPickerMessageIds,
      savingMessageIds,
    ],
  );

  const participants = useMemo(
    () => channel.collections.participants ?? [],
    [channel.collections.participants],
  );
  const fallbackParticipant = participants[0];
  const guardian = participants.find(isGuardianProfile) ?? fallbackParticipant;
  const educator =
    participants.find(isEducatorProfile) ??
    participants.find((participant) => participant.ids.id !== guardian?.ids.id) ??
    fallbackParticipant;
  const resolvedCurrentUserId =
    currentUserIdProp ??
    currentUserProfile?.ids.id ??
    guardian?.ids.id ??
    participants[0]?.ids.id ??
    '';
  const resolvedCurrentUserProfile =
    currentUserProfile ??
    participants.find((participant) => participant.ids.id === resolvedCurrentUserId) ??
    null;
  const senderProfile =
    resolvedCurrentUserProfile ?? guardian ?? educator ?? fallbackParticipant;
  const currentUserId = resolvedCurrentUserId;
  const typingParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          typingIds.has(participant.ids.id) && participant.ids.id !== currentUserId,
      ),
    [participants, typingIds, currentUserId],
  );

  const upsertTypingProfile = useCallback((profileId: string, isTyping: boolean) => {
    setTypingIds((prev) => {
      const next = new Set(prev);
      if (isTyping) {
        next.add(profileId);
      } else {
        next.delete(profileId);
      }
      return next;
    });
  }, []);

  const clearTypingTimeout = useCallback((profileId: string) => {
    const existing = typingTimeoutsRef.current.get(profileId);
    if (existing) {
      window.clearTimeout(existing);
      typingTimeoutsRef.current.delete(profileId);
    }
  }, []);

  const markChannelRead = useCallback(
    (nextLastReadMessageId: UUID) => {
      if (!nextLastReadMessageId || !channel.ids.id) {
        return;
      }
      if (lastReadMessageId === nextLastReadMessageId) {
        return;
      }

      const nextLastReadAt = new Date().toISOString();
      setLastReadMessageId(nextLastReadMessageId);
      setLastReadAt(nextLastReadAt);
      window.dispatchEvent(
        new CustomEvent('dm:mark-read', {
          detail: {
            channelId: channel.ids.id,
            lastReadMessageId: nextLastReadMessageId,
            lastReadAt: nextLastReadAt,
          },
        }),
      );

      pendingReadMessageIdRef.current = nextLastReadMessageId;
      if (persistReadStateTimerRef.current) {
        window.clearTimeout(persistReadStateTimerRef.current);
      }
      persistReadStateTimerRef.current = window.setTimeout(() => {
        const readMessageId = pendingReadMessageIdRef.current;
        if (!readMessageId || readMessageId === lastPersistedReadMessageIdRef.current) {
          return;
        }

        const persistReadState = async () => {
          try {
            const response = await runWithNetworkActivity(() =>
              window.fetch('/api/messages/read-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  channelId: channel.ids.id,
                  lastReadMessageId: readMessageId,
                }),
              }),
            );
            if (response.ok) {
              lastPersistedReadMessageIdRef.current = readMessageId;
            }
          } catch {
            // best effort client sync
          }
        };
        void persistReadState();
      }, READ_STATE_PERSIST_DEBOUNCE_MS);
    },
    [channel.ids.id, lastReadMessageId, runWithNetworkActivity],
  );

  const handleOpenThread = useCallback(
    async (thread: ThreadVM, parentMessage: MessageVM) => {
      const localThreadMessages = messages
        .filter((message) => message.social.thread?.ids.id === thread.ids.id)
        .sort(
          (a, b) =>
            new Date(a.core.createdAt).getTime() - new Date(b.core.createdAt).getTime(),
        );
      const localReplyItems = localThreadMessages.filter(
        (message) => message.ids.id !== parentMessage.ids.id,
      );
      const expectedReplies = Math.max(0, (thread.stats?.messageCount ?? 1) - 1);
      const needsFetch = expectedReplies > localReplyItems.length;

      let resolvedReplies = localReplyItems;
      if (needsFetch) {
        try {
          const params = new URLSearchParams({
            threadId: thread.ids.id,
            parentMessageId: parentMessage.ids.id,
          });
          const response = await runWithNetworkActivity(() =>
            window.fetch(`/api/messages/thread?${params.toString()}`),
          );
          if (response.ok) {
            const payload = (await response.json()) as {
              success?: boolean;
              messages?: MessageVM[];
            };
            const fetchedMessages = payload.success ? (payload.messages ?? []) : [];
            fetchedMessages.forEach((message) => addMessage(message));
            resolvedReplies = fetchedMessages.filter(
              (message) => message.ids.id !== parentMessage.ids.id,
            );
          }
        } catch {
          // Best effort thread hydration for inline view.
        }
      }

      setThreadData(thread, {
        replies: {
          items: resolvedReplies,
          total:
            typeof thread.stats?.messageCount === 'number'
              ? Math.max(0, thread.stats.messageCount - 1)
              : resolvedReplies.length,
        },
        parentMessage,
      });

      const latestReply = [...resolvedReplies].sort(
        (a, b) =>
          new Date(a.core.createdAt).getTime() - new Date(b.core.createdAt).getTime(),
      )[resolvedReplies.length - 1];
      if (latestReply?.ids.id) {
        const optimisticReadAt = new Date().toISOString();
        const optimisticThread = {
          ...thread,
          readState: {
            threadId: thread.ids.id,
            channelId: channel.ids.id,
            lastReadMessageId: latestReply.ids.id,
            lastReadAt: optimisticReadAt,
            unreadCount: 0,
          },
        } as ThreadVM;

        setThreadData(optimisticThread, {
          replies: {
            items: resolvedReplies,
            total:
              typeof optimisticThread.stats?.messageCount === 'number'
                ? Math.max(0, optimisticThread.stats.messageCount - 1)
                : resolvedReplies.length,
          },
          parentMessage,
        });

        updateMessage(parentMessage.ids.id, {
          social: {
            ...(parentMessage.social ?? { reactions: [] }),
            thread: optimisticThread,
          } as MessageVM['social'],
        });

        try {
          const response = await runWithNetworkActivity(() =>
            window.fetch('/api/messages/thread-read-state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                channelId: channel.ids.id,
                threadId: thread.ids.id,
                lastReadMessageId: latestReply.ids.id,
              }),
            }),
          );

          if (response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              success?: boolean;
              unreadCount?: number;
              lastReadAt?: string;
              lastReadMessageId?: string;
            } | null;

            if (payload?.success) {
              const reconciledThread = {
                ...optimisticThread,
                readState: {
                  threadId: thread.ids.id,
                  channelId: channel.ids.id,
                  lastReadMessageId:
                    payload.lastReadMessageId ??
                    optimisticThread.readState?.lastReadMessageId,
                  lastReadAt:
                    payload.lastReadAt ?? optimisticThread.readState?.lastReadAt,
                  unreadCount: Math.max(0, payload.unreadCount ?? 0),
                },
              } as ThreadVM;

              setThreadData(reconciledThread, {
                replies: {
                  items: resolvedReplies,
                  total:
                    typeof reconciledThread.stats?.messageCount === 'number'
                      ? Math.max(0, reconciledThread.stats.messageCount - 1)
                      : resolvedReplies.length,
                },
                parentMessage,
              });

              updateMessage(parentMessage.ids.id, {
                social: {
                  ...(parentMessage.social ?? { reactions: [] }),
                  thread: reconciledThread,
                } as MessageVM['social'],
              });
            }
          }
        } catch {
          // Best effort thread read-state sync.
        }
      }

      const isDraftThreadOnly =
        thread.parent.messageId === parentMessage.ids.id &&
        resolvedReplies.length === 0 &&
        (thread.stats?.messageCount ?? 0) <= 1;
      if (isDraftThreadOnly) {
        return;
      }

      if (!latestReply?.ids.id) {
        updateMessage(parentMessage.ids.id, {
          social: {
            ...(parentMessage.social ?? { reactions: [] }),
            thread,
          } as MessageVM['social'],
        });
      }
    },
    [
      addMessage,
      channel.ids.id,
      messages,
      runWithNetworkActivity,
      setThreadData,
      updateMessage,
    ],
  );

  const syncParentThreadFromReply = useCallback(
    (message: MessageVM) => {
      const thread = message.social.thread;
      const parentMessageId = thread?.parent.messageId;
      if (!thread || !parentMessageId || parentMessageId === message.ids.id) {
        return;
      }
      updateMessage(parentMessageId, {
        social: { thread } as MessageVM['social'],
      });
    },
    [updateMessage],
  );

  const handleSendMessage = useCallback(
    (content: string, mentions?: MessageMentionVM[], homework?: AssignmentSendInput) => {
      if (readOnly) return;
      if (!senderProfile) return;
      if (messageFilter) {
        toggleMessageFilter(messageFilter);
      }
      const sendMessage = async () => {
        if (messageWriteClient && currentUserId) {
          const created = await runWithNetworkActivity(() =>
            messageWriteClient.sendTextMessage({
              orgId: channel.ids.orgId,
              channelId: channel.ids.id,
              senderProfileId: currentUserId,
              content,
              mentions,
              homework,
            }),
          );
          const exists = messagesRef.current.some(
            (message) => message.ids.id === created.ids.id,
          );
          if (!exists) {
            addMessage(created);
          }
          return;
        }
        const newMessage = buildOptimisticComposerMessage({
          orgId: channel.ids.orgId,
          sender: senderProfile,
          content,
          mentions,
          homework,
        });
        addMessage(newMessage);
      };
      void sendMessage();
    },
    [
      addMessage,
      senderProfile,
      messageFilter,
      toggleMessageFilter,
      channel.ids.orgId,
      channel.ids.id,
      messageWriteClient,
      currentUserId,
      readOnly,
      runWithNetworkActivity,
    ],
  );

  const handleSendThreadReply = useCallback(
    async (
      parentMessage: MessageVM,
      thread: ThreadVM,
      content: string,
      mentions?: MessageMentionVM[],
    ) => {
      if (readOnly || !senderProfile) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      const createdMessage =
        messageWriteClient && currentUserId
          ? await runWithNetworkActivity(() =>
              messageWriteClient.sendTextMessage({
                orgId: channel.ids.orgId,
                channelId: channel.ids.id,
                senderProfileId: currentUserId,
                content: trimmed,
                mentions,
                threadId: thread.ids.id,
                threadParentId: thread.parent.messageId ?? parentMessage.ids.id,
              }),
            )
          : ({
              ids: { id: `reply-${Date.now()}`, orgId: channel.ids.orgId },
              core: {
                type: 'text',
                sender: senderProfile,
                createdAt: new Date().toISOString(),
                visibility: { type: 'all' },
              },
              social: {
                reactions: [],
              },
              state: {
                isSaved: false,
              },
              content: { text: trimmed, mentions },
            } as TextMessageVM);

      const exists = messagesRef.current.some(
        (message) => message.ids.id === createdMessage.ids.id,
      );
      if (!exists) {
        addMessage(createdMessage);
      }

      const now = new Date().toISOString();
      const existingReplyCount = messagesRef.current.filter((message) => {
        const messageThread = message.social.thread;
        if (!messageThread) return false;
        if (messageThread.ids.id !== thread.ids.id) return false;
        return message.ids.id !== parentMessage.ids.id;
      }).length;
      const { thread: updatedThread, message: messageWithThread } =
        resolveThreadAfterReply({
          currentThread: thread,
          sentMessage: createdMessage,
          replyCount: existingReplyCount + 1,
          now,
        });

      updateMessage(createdMessage.ids.id, messageWithThread);
      updateMessage(parentMessage.ids.id, {
        social: {
          ...(parentMessage.social ?? { reactions: [] }),
          thread: updatedThread,
        } as MessageVM['social'],
      });
    },
    [
      readOnly,
      senderProfile,
      messageWriteClient,
      currentUserId,
      channel.ids.orgId,
      channel.ids.id,
      addMessage,
      updateMessage,
      runWithNetworkActivity,
    ],
  );

  const handleProfileClick = useCallback(
    (userId: string) => {
      toggle({ key: 'profile', userId });
    },
    [toggle],
  );

  const handleTypingStart = useCallback(() => {
    if (readOnly) return;
    if (!realtimeClient || !currentUserId) return;
    realtimeClient.sendTyping?.({
      orgId: channel.ids.orgId,
      channelId: channel.ids.id,
      profileId: currentUserId,
      isTyping: true,
    });
  }, [realtimeClient, currentUserId, channel.ids.orgId, channel.ids.id, readOnly]);

  const handleTypingStop = useCallback(() => {
    if (readOnly) return;
    if (!realtimeClient || !currentUserId) return;
    realtimeClient.sendTyping?.({
      orgId: channel.ids.orgId,
      channelId: channel.ids.id,
      profileId: currentUserId,
      isTyping: false,
    });
  }, [realtimeClient, currentUserId, channel.ids.orgId, channel.ids.id, readOnly]);

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string, source: 'bar' | 'picker' = 'bar') => {
      if (readOnly) return;
      if (!currentUserId) return;
      const reactionKey = `${messageId}:${emoji}`;
      toggleReaction(messageId, emoji, currentUserId);
      if (messageWriteClient) {
        const persistReaction = async () => {
          if (source === 'picker') {
            setPendingMessageAction(setReactionPickerMessageIds, messageId, true);
          } else {
            setPendingMessageAction(setReactionEmojiKeys, reactionKey, true);
          }
          try {
            await runWithNetworkActivity(() =>
              messageWriteClient.toggleReaction({
                orgId: channel.ids.orgId,
                messageId,
                emoji,
              }),
            );
          } catch {
            toggleReaction(messageId, emoji, currentUserId);
          } finally {
            if (source === 'picker') {
              setPendingMessageAction(setReactionPickerMessageIds, messageId, false);
            } else {
              setPendingMessageAction(setReactionEmojiKeys, reactionKey, false);
            }
          }
        };
        void persistReaction();
      }
    },
    [
      toggleReaction,
      currentUserId,
      messageWriteClient,
      channel.ids.orgId,
      readOnly,
      runWithNetworkActivity,
      setPendingMessageAction,
    ],
  );

  const handleToggleSaved = useCallback(
    (messageId: string) => {
      if (readOnly) return;
      const message = messages.find((m) => m.ids.id === messageId);
      if (!message) return;
      const newSavedState = !message.state?.isSaved;
      toggleSaved(messageId);
      if (messageWriteClient) {
        const persistSavedState = async () => {
          setPendingMessageAction(setSavingMessageIds, messageId, true);
          try {
            await runWithNetworkActivity(() =>
              messageWriteClient.toggleSavedMessage({
                orgId: channel.ids.orgId,
                messageId,
                isSaved: newSavedState,
              }),
            );
          } catch {
            toggleSaved(messageId);
          } finally {
            setPendingMessageAction(setSavingMessageIds, messageId, false);
          }
        };
        void persistSavedState();
      }
    },
    [
      channel.ids.orgId,
      messageWriteClient,
      messages,
      readOnly,
      runWithNetworkActivity,
      toggleSaved,
      setPendingMessageAction,
    ],
  );

  const handleToggleHidden = useCallback(
    async (messageId: string) => {
      if (readOnly) return;
      const message = messages.find((m) => m.ids.id === messageId);
      if (!message) return;

      const newHiddenState = !message.state?.isHidden;

      if (messageWriteClient) {
        setPendingMessageAction(setHidingMessageIds, messageId, true);
        try {
          await runWithNetworkActivity(() =>
            messageWriteClient.toggleHiddenMessage({
              orgId: channel.ids.orgId,
              messageId,
              isHidden: newHiddenState,
            }),
          );
          // Update local state immediately for better UX
          toggleHidden(messageId);
          // Broadcast to all other clients via realtime
          if (realtimeClient?.broadcastMessageUpdated) {
            await runWithNetworkActivity(async () => {
              await realtimeClient.broadcastMessageUpdated?.({
                channelId: channel.ids.id,
                messageId,
              });
            });
          }
        } catch (error) {
          console.error('Failed to toggle hidden message:', error);
          return;
        } finally {
          setPendingMessageAction(setHidingMessageIds, messageId, false);
        }
      }
    },
    [
      messageWriteClient,
      channel.ids.orgId,
      channel.ids.id,
      realtimeClient,
      messages,
      toggleHidden,
      readOnly,
      runWithNetworkActivity,
      setPendingMessageAction,
    ],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (readOnly && currentUserProfile?.kind !== 'staff') return;
      if (messageWriteClient) {
        setPendingMessageAction(setDeletingMessageIds, messageId, true);
        try {
          await runWithNetworkActivity(() =>
            messageWriteClient.deleteMessage({
              orgId: channel.ids.orgId,
              messageId,
            }),
          );
          // Update local state immediately for better UX
          deleteMessage(messageId);
          // Broadcast to all other clients via realtime
          if (realtimeClient?.broadcastMessageDeleted) {
            await runWithNetworkActivity(async () => {
              await realtimeClient.broadcastMessageDeleted?.({
                channelId: channel.ids.id,
                messageId,
              });
            });
          }
        } catch (error) {
          console.error('Failed to delete message:', error);
          return;
        } finally {
          setPendingMessageAction(setDeletingMessageIds, messageId, false);
        }
      }
    },
    [
      messageWriteClient,
      channel.ids.orgId,
      channel.ids.id,
      realtimeClient,
      deleteMessage,
      readOnly,
      currentUserProfile?.kind,
      runWithNetworkActivity,
      setPendingMessageAction,
    ],
  );

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !message.social.thread?.parent?.messageId ||
          message.social.thread.parent.messageId === message.ids.id,
      ),
    [messages],
  );

  const savedCount = useMemo(
    () => messages.filter((m) => m.state?.isSaved).length,
    [messages],
  );
  const homeworkCount = useMemo(
    () =>
      visibleMessages.filter(
        (message) =>
          message.core.type === 'lesson-assignment' ||
          message.core.type === 'homework-submission',
      ).length,
    [visibleMessages],
  );
  const sessionSummaryCount = useMemo(
    () =>
      visibleMessages.filter((message) => message.core.type === 'session-summary').length,
    [visibleMessages],
  );

  const filteredMessages = useMemo(() => {
    if (!messageFilter) return visibleMessages;
    if (messageFilter === 'homework') {
      return visibleMessages.filter(
        (message) =>
          message.core.type === 'lesson-assignment' ||
          message.core.type === 'homework-submission',
      );
    }
    if (messageFilter === 'session-summary') {
      return visibleMessages.filter((message) => message.core.type === 'session-summary');
    }
    return visibleMessages;
  }, [messageFilter, visibleMessages]);

  useEffect(() => {
    setSavedCount(savedCount);
  }, [savedCount, setSavedCount]);

  useEffect(() => {
    setHomeworkCount(homeworkCount);
    setSessionSummaryCount(sessionSummaryCount);
  }, [homeworkCount, sessionSummaryCount, setHomeworkCount, setSessionSummaryCount]);

  useEffect(() => {
    if (currentUserId) {
      setCurrentUserId(currentUserId);
    }
  }, [currentUserId, setCurrentUserId]);

  useEffect(() => {
    setMessages(messages);
  }, [messages, setMessages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setHasMoreOlderMessages(channelMessages.length >= MESSAGES_PAGE_SIZE);
    setOldestCursor(channelMessages[0]?.core.createdAt ?? null);
  }, [channel.ids.id, channelMessages]);

  useEffect(() => {
    const hashTab = hashToTabKey(window.location.hash);
    if (hashTab) {
      setActiveTab(hashTab);
    } else {
      setActiveTab(defaultTab);
    }
    setLoadedFiles(null);
    setFilesLoadError(null);
    setIsLoadingFiles(false);
    setLoadedSchedules(null);
    setSchedulesLoadError(null);
    setIsLoadingSchedules(false);
  }, [channel.ids.id, defaultTab]);

  useEffect(() => {
    if (containerTabs.some((tab) => tab.key === activeTab)) {
      return;
    }
    setActiveTab(defaultTab);
  }, [containerTabs, activeTab, defaultTab]);

  useEffect(() => {
    if (activeTab !== 'schedule') return;
    if (enableScheduleTab) return;
    setActiveTab(defaultTab);
  }, [activeTab, enableScheduleTab, defaultTab]);

  useEffect(() => {
    const nextHash = `#${tabKeyToHash(activeTab)}`;
    if (window.location.hash === nextHash) return;
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}${nextHash}`,
    );
  }, [activeTab]);

  useEffect(() => {
    const onHashChange = () => {
      const hashTab = hashToTabKey(window.location.hash);
      if (!hashTab) return;
      setActiveTab(hashTab);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (activeTab !== 'messages') return;
    const messageId = pendingSavedNavigationMessageIdRef.current;
    if (!messageId) return;
    pendingSavedNavigationMessageIdRef.current = null;
    window.requestAnimationFrame(() => {
      messageListRef.current?.scrollToMessage(messageId);
    });
  }, [activeTab]);

  const handleSavedMessageClick = useCallback((messageId: string) => {
    pendingSavedNavigationMessageIdRef.current = messageId;
    setActiveTab('messages');
  }, []);

  useEffect(() => {
    setLastReadMessageId(channel.collections.readState?.lastReadMessageId);
  }, [channel.ids.id, channel.collections.readState?.lastReadMessageId]);
  useEffect(() => {
    setLastReadAt(channel.collections.readState?.lastReadAt);
  }, [channel.ids.id, channel.collections.readState?.lastReadAt]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMoreOlderMessages || !oldestCursor) {
      return false;
    }
    setIsLoadingOlder(true);
    try {
      const params = new URLSearchParams({
        channelId: channel.ids.id,
        before: oldestCursor,
        limit: String(MESSAGES_PAGE_SIZE),
      });
      const response = await runWithNetworkActivity(() =>
        window.fetch(`/api/messages/channel-page?${params.toString()}`),
      );
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json()) as {
        success?: boolean;
        messages?: MessageVM[];
        hasMore?: boolean;
        nextCursor?: string | null;
      };
      if (!payload.success || !payload.messages?.length) {
        setHasMoreOlderMessages(Boolean(payload.hasMore));
        if (payload.nextCursor !== undefined) {
          setOldestCursor(payload.nextCursor);
        }
        return false;
      }
      prependMessages(payload.messages);
      setHasMoreOlderMessages(Boolean(payload.hasMore));
      setOldestCursor(payload.nextCursor ?? payload.messages[0]?.core.createdAt ?? null);
      return true;
    } finally {
      setIsLoadingOlder(false);
    }
  }, [
    channel.ids.id,
    hasMoreOlderMessages,
    isLoadingOlder,
    oldestCursor,
    prependMessages,
    runWithNetworkActivity,
  ]);

  useEffect(() => {
    if (persistReadStateTimerRef.current) {
      window.clearTimeout(persistReadStateTimerRef.current);
      persistReadStateTimerRef.current = null;
    }
    pendingReadMessageIdRef.current = null;
    lastPersistedReadMessageIdRef.current =
      channel.collections.readState?.lastReadMessageId ?? null;
  }, [channel.ids.id, channel.collections.readState?.lastReadMessageId]);

  useEffect(() => {
    const typingTimeouts = typingTimeoutsRef.current;
    return () => {
      if (persistReadStateTimerRef.current) {
        window.clearTimeout(persistReadStateTimerRef.current);
      }
      typingTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      typingTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!realtimeClient) return;
    let isActive = true;
    let cleanup: (() => void) | undefined;

    const subscribe = async () => {
      const result = await realtimeClient.subscribe({
        orgId: channel.ids.orgId,
        channelId: channel.ids.id,
        onEvent: (event) => {
          if (!isActive) return;
          if (event.type === 'message-added') {
            const exists = messagesRef.current.some(
              (message) => message.ids.id === event.message.ids.id,
            );
            if (exists) {
              updateMessage(event.message.ids.id, event.message);
              syncParentThreadFromReply(event.message);
              return;
            }
            addMessage(event.message);
            syncParentThreadFromReply(event.message);
          }
          if (event.type === 'message-updated') {
            updateMessage(event.message.ids.id, event.message);
            syncParentThreadFromReply(event.message);
          }
          if (event.type === 'message-deleted') {
            deleteMessage(event.messageId);
          }
          if (event.type === 'typing-start') {
            if (event.profileId === currentUserId) return;
            upsertTypingProfile(event.profileId, true);
            clearTypingTimeout(event.profileId);
            const timeoutId = window.setTimeout(() => {
              upsertTypingProfile(event.profileId, false);
              typingTimeoutsRef.current.delete(event.profileId);
            }, TYPING_REMOTE_TIMEOUT_MS);
            typingTimeoutsRef.current.set(event.profileId, timeoutId);
          }
          if (event.type === 'typing-stop') {
            clearTypingTimeout(event.profileId);
            upsertTypingProfile(event.profileId, false);
          }
        },
      });

      if (typeof result === 'function') {
        cleanup = result;
        return;
      }
      if (result && typeof result.unsubscribe === 'function') {
        cleanup = () => result.unsubscribe();
      }
    };

    void subscribe();

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [
    realtimeClient,
    channel.ids.orgId,
    channel.ids.id,
    addMessage,
    updateMessage,
    syncParentThreadFromReply,
    deleteMessage,
    currentUserId,
    upsertTypingProfile,
    clearTypingTimeout,
  ]);

  useEffect(() => {
    if (readOnly || !joinLiveSession) {
      setJoinLiveSession(undefined);
      return;
    }

    setJoinLiveSession(joinLiveSession);
  }, [joinLiveSession, readOnly, setJoinLiveSession]);

  useEffect(() => {
    if (readOnly) {
      setCreateTextMessage(() => null);
      return;
    }
    if (!senderProfile) return;
    setCreateTextMessage(
      (content: string, mentions?: MessageMentionVM[]): TextMessageVM => ({
        ids: { id: `reply-${Date.now()}`, orgId: channel.ids.orgId },
        core: {
          type: 'text',
          sender: senderProfile,
          createdAt: new Date().toISOString(),
          visibility: { type: 'all' },
        },
        social: {
          reactions: [],
        },
        state: {
          isSaved: false,
        },
        content: { text: content, mentions },
      }),
    );
  }, [senderProfile, setCreateTextMessage, channel.ids.orgId, readOnly]);

  useEffect(() => {
    if (readOnly) {
      setSendTextMessage(async () => null);
      return;
    }
    if (!senderProfile) return;
    setSendTextMessage(
      async ({ content, mentions, homework, threadId, threadParentId }) => {
        if (messageWriteClient && currentUserId) {
          const sendInput = {
            orgId: channel.ids.orgId,
            channelId: channel.ids.id,
            senderProfileId: currentUserId,
            content,
            mentions,
            homework,
            threadId,
            threadParentId,
          } as Parameters<MessageWriteClient['sendTextMessage']>[0];
          const created = await messageWriteClient.sendTextMessage(sendInput);
          const exists = messagesRef.current.some(
            (message) => message.ids.id === created.ids.id,
          );
          if (!exists) {
            addMessage(created);
          }
          return created;
        }
        return {
          ids: { id: `reply-${Date.now()}`, orgId: channel.ids.orgId },
          core: {
            type: 'text',
            sender: senderProfile,
            createdAt: new Date().toISOString(),
            visibility: { type: 'all' },
          },
          social: {
            reactions: [],
          },
          state: {
            isSaved: false,
          },
          content: { text: content, mentions },
        };
      },
    );
  }, [
    senderProfile,
    setSendTextMessage,
    channel.ids.orgId,
    channel.ids.id,
    messageWriteClient,
    currentUserId,
    addMessage,
    readOnly,
  ]);

  useEffect(() => {
    if (readOnly) {
      setSendFileMessage(async () => null);
      return;
    }
    if (!senderProfile) return;
    setSendFileMessage(async (input) => {
      if (uploadFileMessage) {
        const createdMessages = await uploadFileMessage(input);
        createdMessages.forEach((created) => {
          const exists = messagesRef.current.some(
            (message) => message.ids.id === created.ids.id,
          );
          if (!exists) {
            addMessage(created);
          }
        });
        return createdMessages[0] ?? null;
      }
      return {
        ids: { id: `file-${Date.now()}`, orgId: channel.ids.orgId },
        core: {
          type: 'file',
          sender: senderProfile,
          createdAt: new Date().toISOString(),
          visibility: { type: 'all' },
        },
        social: {
          reactions: [],
        },
        state: {
          isSaved: false,
        },
        content: input.content ? { text: input.content } : undefined,
        attachment: {
          type: 'file',
          url: '',
          name: input.attachments[0]?.file.name ?? 'Attachment',
          size: input.attachments[0]?.file.size,
          mimeType: input.attachments[0]?.file.type || undefined,
        },
        attachments: input.attachments.slice(1).length
          ? input.attachments.map((attachment) => ({
              type: 'file' as const,
              url: '',
              name: attachment.file.name,
              size: attachment.file.size,
              mimeType: attachment.file.type || undefined,
            }))
          : undefined,
      } satisfies FileMessageVM;
    });
  }, [
    addMessage,
    channel.ids.orgId,
    readOnly,
    senderProfile,
    setSendFileMessage,
    uploadFileMessage,
  ]);

  useEffect(() => {
    setThreadHandlers({
      onAddMessage: addMessage,
      onUpdateMessage: updateMessage,
      onDeleteMessage: readOnly ? undefined : handleDeleteMessage,
      onToggleReaction: readOnly ? undefined : handleToggleReaction,
      onToggleSaved: readOnly ? undefined : handleToggleSaved,
      onToggleHidden: readOnly ? undefined : handleToggleHidden,
    });
  }, [
    addMessage,
    updateMessage,
    handleDeleteMessage,
    handleToggleReaction,
    handleToggleSaved,
    handleToggleHidden,
    setThreadHandlers,
    readOnly,
  ]);

  useEffect(() => {
    setScrollToMessage(() => (messageId: string) => {
      messageListRef.current?.scrollToMessage(messageId);
    });
  }, [setScrollToMessage]);

  useEffect(() => {
    setGetMessageActionState(getMessageActionState);
  }, [getMessageActionState, setGetMessageActionState]);

  useEffect(() => {
    if (activeTab !== 'files' || loadedFiles) {
      return;
    }
    let isCancelled = false;
    const loadFiles = async () => {
      setIsLoadingFiles(true);
      setFilesLoadError(null);
      try {
        const params = new URLSearchParams({ channelId: channel.ids.id });
        const response = await runWithNetworkActivity(() =>
          window.fetch(`/api/messages/channel-files?${params.toString()}`),
        );
        if (!response.ok) {
          throw new Error('Failed to load files');
        }
        const payload = (await response.json()) as {
          success?: boolean;
          files?: ChannelFileItemVM[];
        };
        if (!payload.success) {
          throw new Error('Failed to load files');
        }
        if (!isCancelled) {
          const files = payload.files ?? [];
          files.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setLoadedFiles(files);
        }
      } catch {
        if (!isCancelled) {
          setFilesLoadError('Unable to load files right now.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingFiles(false);
        }
      }
    };
    void loadFiles();
    return () => {
      isCancelled = true;
    };
  }, [activeTab, channel.ids.id, loadedFiles, runWithNetworkActivity]);

  useEffect(() => {
    if (activeTab !== 'schedule' || loadedSchedules) {
      return;
    }
    let isCancelled = false;
    const loadSchedules = async () => {
      setIsLoadingSchedules(true);
      setSchedulesLoadError(null);
      try {
        const params = new URLSearchParams({ channelId: channel.ids.id });
        const response = await runWithNetworkActivity(() =>
          window.fetch(`/api/messages/channel-schedules?${params.toString()}`),
        );
        if (!response.ok) {
          throw new Error('Failed to load schedules');
        }
        const payload = (await response.json()) as {
          success?: boolean;
          schedules?: ClassScheduleVM[];
        };
        if (!payload.success) {
          throw new Error('Failed to load schedules');
        }
        if (!isCancelled) {
          setLoadedSchedules(payload.schedules ?? []);
        }
      } catch {
        if (!isCancelled) {
          setSchedulesLoadError('Unable to load schedule right now.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSchedules(false);
        }
      }
    };
    void loadSchedules();
    return () => {
      isCancelled = true;
    };
  }, [activeTab, channel.ids.id, loadedSchedules, runWithNetworkActivity]);

  const messageListProps = useMemo(() => {
    const emptyStateCopy = buildChannelEmptyStateCopy({
      channel,
      currentUserProfile: resolvedCurrentUserProfile,
      participants: channel.collections.participants,
    });

    return {
      messages: filteredMessages,
      emptyStateTitle: emptyStateCopy.title,
      emptyStateDescription: emptyStateCopy.description,
      emptyStateIcon: emptyStateCopy.icon,
      emptyStateStarterAction: emptyStateCopy.starterAction
        ? {
            label: emptyStateCopy.starterAction.label,
            onClick: () =>
              setComposerPrefillRequest({
                value: emptyStateCopy.starterAction?.prefillText ?? '',
                nonce: Date.now(),
              }),
          }
        : undefined,
      threadMessagesSource: messages,
      onOpenThread: handleOpenThread,
      onProfileClick: handleProfileClick,
      onToggleReaction: handleToggleReaction,
      onToggleSaved: handleToggleSaved,
      onToggleHidden: handleToggleHidden,
      onDelete: handleDeleteMessage,
      getMessageActionState,
      currentUserId,
      currentUserCanDeleteAnyMessages: currentUserProfile?.kind === 'staff',
      isReadOnly: readOnly,
      onSendThreadReply: handleSendThreadReply,
      lastReadMessageId,
      lastReadAt,
      hasMore: hasMoreOlderMessages,
      isLoadingMore: isLoadingOlder,
      onLoadMore: handleLoadOlderMessages,
      initialScrollToBottom: true,
      onUnreadViewed: markChannelRead,
    };
  }, [
    channel,
    filteredMessages,
    messages,
    handleOpenThread,
    handleProfileClick,
    handleToggleReaction,
    handleToggleSaved,
    handleToggleHidden,
    handleDeleteMessage,
    getMessageActionState,
    currentUserId,
    currentUserProfile?.kind,
    resolvedCurrentUserProfile,
    readOnly,
    handleSendThreadReply,
    lastReadMessageId,
    lastReadAt,
    hasMoreOlderMessages,
    isLoadingOlder,
    handleLoadOlderMessages,
    markChannelRead,
    setComposerPrefillRequest,
  ]);

  const renderActiveTabContent = () => {
    if (activeTab === 'messages') {
      return (
        <>
          <MessageList ref={messageListRef} {...messageListProps} />
          {typingParticipants.length ? (
            <TypingIndicator
              profiles={typingParticipants}
              className="border-t border-border"
            />
          ) : null}
          {readOnly ? (
            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Read-only supervised conversation
            </div>
          ) : (
            <MessageInput
              onSend={handleSendMessage}
              onAttachFiles={(attachments, content) => {
                if (readOnly || !uploadFileMessage) {
                  return;
                }
                const sendFile = async () => {
                  const createdMessages = await runWithNetworkActivity(() =>
                    uploadFileMessage({
                      attachments,
                      content,
                    }),
                  );
                  createdMessages.forEach((created) => {
                    if (
                      created.core.type === 'file' ||
                      created.core.type === 'image' ||
                      created.core.type === 'audio-recording'
                    ) {
                      const nextFiles = createChannelFileItems(
                        channel.ids.id,
                        created as
                          | FileMessageVM
                          | ImageMessageVM
                          | AudioRecordingMessageVM,
                      );
                      setLoadedFiles((prev) => {
                        if (!prev) {
                          return prev;
                        }
                        const existingKeys = new Set(
                          prev.map(
                            (item) =>
                              `${item.messageId}:${item.name}:${item.storagePath}`,
                          ),
                        );
                        const merged = [
                          ...nextFiles.filter(
                            (item) =>
                              !existingKeys.has(
                                `${item.messageId}:${item.name}:${item.storagePath}`,
                              ),
                          ),
                          ...prev,
                        ];

                        return merged.sort(
                          (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime(),
                        );
                      });
                    }
                  });
                };
                return sendFile();
              }}
              placeholder={getMessageInputPlaceholder(channel, resolvedCurrentUserId)}
              participants={participants}
              currentUserId={resolvedCurrentUserId}
              showCreateMessageTypeButton={showCreateMessageTypeButton}
              prefillRequest={composerPrefillRequest}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
            />
          )}
        </>
      );
    }

    if (activeTab === 'saved') {
      return (
        <MessagesSavedTab
          messages={visibleMessages}
          onMessageClick={handleSavedMessageClick}
        />
      );
    }

    if (activeTab === 'files') {
      return (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-4">
            {isLoadingFiles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading files...
              </div>
            ) : null}
            {!isLoadingFiles && filesLoadError ? (
              <p className="text-sm text-muted-foreground">{filesLoadError}</p>
            ) : null}
            {!isLoadingFiles && !filesLoadError && filesForDisplay.length === 0 ? (
              <div className="flex min-h-[70vh] w-full items-center justify-center">
                <EmptyMessagesState
                  title="No shared files"
                  description="Files shared in this channel will appear here."
                  icon={<FileText className="size-5" />}
                />
              </div>
            ) : null}
            {!isLoadingFiles && !filesLoadError
              ? filesForDisplay.map((item) =>
                  (() => {
                    const href = buildFileDownloadHref({
                      url: item.url,
                      storagePath: item.storagePath,
                    });
                    const visualKind = getChannelFileVisualKind(item);
                    const FileIcon = getFilesTabIcon(item);
                    const iconTone = getChannelFileVisualTone(visualKind);

                    return (
                      <div
                        key={item.ids.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                      >
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}
                          >
                            <FileIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {item.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.kind === 'design-file'
                                ? (item.tool ?? 'Design file')
                                : (item.mimeType ?? 'File')}
                              {' • '}
                              {formatFileSize(item.size)}
                              {' • '}
                              Uploaded {formatChannelFileUploadedDate(item.createdAt)}
                            </p>
                          </div>
                        </a>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Download ${item.name}`}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    );
                  })(),
                )
              : null}
          </div>
        </ScrollArea>
      );
    }

    if (activeTab === 'schedule') {
      return (
        <MessagesScheduleTab
          schedules={loadedSchedules ?? []}
          isLoading={isLoadingSchedules}
          error={schedulesLoadError}
          timezone={currentUserProfile?.prefs?.timezone ?? null}
        />
      );
    }

    return (
      <MessagesMembersTab
        participants={participants}
        currentUserId={currentUserId}
        onProfileClick={handleProfileClick}
      />
    );
  };

  return (
    <ScheduleDisplayTimeZoneProvider
      timezone={currentUserProfile?.prefs?.timezone ?? null}
    >
      <div className="relative flex h-full min-h-0 flex-1 min-w-0 flex-col">
        <div className="border-b border-border bg-muted/40 px-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (containerTabs.some((tab) => tab.key === value)) {
                setActiveTab(value as MessagesContainerTabKey);
              }
            }}
            className="gap-0"
          >
            <TabsList variant="line" className="h-12 p-0">
              {containerTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="w-auto flex-none px-1.5"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground/70" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
        <div
          key={activeTab}
          data-testid="messages-tab-content"
          className="min-h-0 flex-1 flex flex-col motion-reduce:animate-none animate-in fade-in-0 slide-in-from-right-1 duration-200"
        >
          {renderActiveTabContent()}
        </div>
      </div>
    </ScheduleDisplayTimeZoneProvider>
  );
}
