import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  AppState,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  BriefcaseBusiness,
  ExternalLink,
  FileText,
  MoreVertical,
  Pause,
  Play,
  Presentation,
  ShieldUser,
  Sparkles,
  User,
} from 'lucide-react-native';
import type {
  AudioRecordingMessageVM,
  FileAttachmentVM,
  FileMessageVM,
  ImageAttachmentVM,
  ImageMessageVM,
  LinkPreviewMessageVM,
  MessageMentionVM,
  MessageVM,
  ReactionVM,
} from '@iconicedu/shared-types';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioStatus } from 'expo-audio';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/providers/theme-provider';
import type { MessageListProps } from '@/components/messages/message-list';
import { findLatestUnreadIncomingMessageId } from '@/components/messages/message-list';
import {
  findInlineUnreadStartIndex,
  MessageAvatar,
  RichMessageContent,
  SocialBar,
  VisibilityBadge,
  getAvatarInfo,
  isEmojiOnlyText,
  isRichMessageType,
} from '@/components/messages/message-item';
import {
  ChatImageViewer,
  type ChatImageViewerItem,
} from '@/components/messages/chat-image-viewer';
import { ChatPdfViewer } from '@/components/messages/chat-pdf-viewer';
import { PendingMessageRow } from '@/components/messages/pending-message-row';
import type { AttachmentPayload } from '@/components/messages/attachment-sheet';
import {
  useOnlineProfileIds,
  type PresenceDisplayStatus,
} from '@/hooks/use-online-profile-ids';
import { fetchThreadMessages } from '@/lib/api/queries';
import { useMarkRead } from '@/hooks/use-mark-read';
import { supabase } from '@/lib/supabase/client';

const CHANNEL_FILES_BUCKET = 'channel-files';

const FEED = {
  page: '#FFFFFF',
  text: '#1F2937',
  muted: '#8B9098',
  border: '#E5E7EB',
  blue: '#4F7DF3',
  bubbleOther: 'rgba(148, 163, 184, 0.16)',
  bubbleOwn: 'rgba(45, 212, 168, 0.22)',
  gap: 16,
  radius: 12,
  avatar: 44,
  commentAvatar: 36,
};

function isPdfAttachment(input: {
  name?: string | null;
  mimeType?: string | null;
}): boolean {
  const mimeType = input.mimeType?.toLowerCase() ?? '';
  const name = input.name?.toLowerCase() ?? '';
  return mimeType === 'application/pdf' || name.endsWith('.pdf');
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function findUnreadStartMessageId(input: {
  messages: MessageVM[];
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  unreadCount?: number;
  currentProfileId?: string;
}): string | null {
  const { messages, lastReadMessageId, lastReadAt, unreadCount, currentProfileId } =
    input;
  const normalizedUnreadCount = Math.max(0, unreadCount ?? 0);
  if (messages.length === 0) return null;

  const findIncomingId = (startIndex: number): string | null => {
    for (let index = startIndex; index < messages.length; index += 1) {
      const message = messages[index];
      if (!currentProfileId || message.core.sender.ids.id !== currentProfileId) {
        return message.ids.id;
      }
    }
    return null;
  };

  if (lastReadMessageId) {
    const lastReadIndex = messages.findIndex(
      (message) => message.ids.id === lastReadMessageId,
    );
    if (lastReadIndex >= 0) return findIncomingId(lastReadIndex + 1);
  }

  if (lastReadAt) {
    const lastReadAtTime = new Date(lastReadAt).getTime();
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (new Date(messages[index]!.core.createdAt).getTime() <= lastReadAtTime) {
        return findIncomingId(index + 1);
      }
    }
    return findIncomingId(0);
  }

  if (normalizedUnreadCount <= 0) return null;
  return findIncomingId(Math.max(0, messages.length - normalizedUnreadCount));
}

const FONT = {
  body: 15,
  bodyLine: 20,
  emoji: 36,
  emojiLine: 42,
  title: 14,
  titleLine: 17,
  meta: 13,
  metaLine: 16,
  small: 12,
  smallLine: 15,
};

type FeedMessageListProps = MessageListProps;

function getMessageText(message: MessageVM): string {
  return (message as { content?: { text?: string } }).content?.text ?? '';
}

function getMentions(message: MessageVM): MessageMentionVM[] | undefined {
  return (message as { content?: { mentions?: MessageMentionVM[] } }).content?.mentions;
}

function applyOptimisticReaction(
  reactions: ReactionVM[] | undefined,
  emoji: string,
  currentAccountId?: string,
): ReactionVM[] {
  const current = reactions ?? [];
  const existing = current.find((reaction) => reaction.emoji === emoji);

  if (existing?.reactedByMe) {
    return existing.count <= 1
      ? current.filter((reaction) => reaction.emoji !== emoji)
      : current.map((reaction) =>
          reaction.emoji === emoji
            ? { ...reaction, count: reaction.count - 1, reactedByMe: false }
            : reaction,
        );
  }

  if (existing) {
    return current.map((reaction) =>
      reaction.emoji === emoji
        ? { ...reaction, count: reaction.count + 1, reactedByMe: true }
        : reaction,
    );
  }

  return [
    ...current,
    {
      emoji,
      count: 1,
      reactedByMe: true,
      sampleUserIds: currentAccountId ? [currentAccountId] : undefined,
    },
  ];
}

function getRoleLabel(kind?: string | null): string {
  if (kind === 'guardian') return 'Parent';
  if (kind === 'child') return 'Student';
  if (kind === 'staff') return 'Support';
  if (kind === 'educator') return 'Tutor';
  if (kind === 'system') return 'System';
  return 'Member';
}

const ROLE_ICON_MAP = {
  educator: Presentation,
  guardian: ShieldUser,
  child: User,
  staff: BriefcaseBusiness,
  system: Sparkles,
} as const;

function getRoleIcon(kind?: string | null) {
  return ROLE_ICON_MAP[kind as keyof typeof ROLE_ICON_MAP] ?? User;
}

function formatFeedDate(iso: string): string {
  const date = new Date(iso);
  const dateText = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeText = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateText} / ${timeText}`;
}

function formatRelative(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function buildSegments(text: string, mentions?: MessageMentionVM[]) {
  if (!mentions?.length) return [{ kind: 'text' as const, value: text }];
  const parts: Array<{ kind: 'text' | 'mention'; value: string }> = [];
  const sorted = [...mentions].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const mention of sorted) {
    if (mention.start > cursor) {
      parts.push({ kind: 'text', value: text.slice(cursor, mention.start) });
    }
    parts.push({ kind: 'mention', value: mention.displayName });
    cursor = mention.end;
  }
  if (cursor < text.length) parts.push({ kind: 'text', value: text.slice(cursor) });
  return parts;
}

function FeedText({
  text,
  mentions,
  size = FONT.body,
  lineHeight = FONT.bodyLine,
  color,
  mentionColor,
}: {
  text: string;
  mentions?: MessageMentionVM[];
  size?: number;
  lineHeight?: number;
  color: string;
  mentionColor: string;
}) {
  return (
    <Text style={[styles.feedText, { color, fontSize: size, lineHeight }]}>
      {buildSegments(text, mentions).map((segment, index) =>
        segment.kind === 'mention' ? (
          <Text key={index} style={{ color: mentionColor, fontWeight: '700' }}>
            {segment.value}
          </Text>
        ) : (
          <Text key={index}>{segment.value}</Text>
        ),
      )}
    </Text>
  );
}

function FeedHeader({
  message,
  compact = false,
  presenceStatus,
  onProfilePress,
  onMorePress,
}: {
  message: MessageVM;
  compact?: boolean;
  presenceStatus?: PresenceDisplayStatus | null;
  onProfilePress?: (user: MessageVM['core']['sender']) => void;
  onMorePress?: (message: MessageVM) => void;
}) {
  const { colors } = useTheme();
  const senderName = message.core.sender.profile.displayName;
  const { url, seed } = getAvatarInfo(message);
  const RoleIcon = getRoleIcon(message.core.sender.kind);
  const handleProfilePress = () => onProfilePress?.(message.core.sender);
  return (
    <View style={styles.headerRow}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={handleProfilePress}
        disabled={!onProfilePress}
        accessibilityLabel={`${senderName} profile avatar`}
      >
        <MessageAvatar
          name={senderName}
          src={url}
          seed={seed}
          role={message.core.sender.kind}
          presence={message.core.sender.presence}
          presenceStatus={presenceStatus}
          size={compact ? FEED.commentAvatar : FEED.avatar}
          badgeSizeOverride={compact ? 14 : 18}
        />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIdentity}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleProfilePress}
              disabled={!onProfilePress}
              style={styles.senderNameButton}
              accessibilityLabel={`${senderName} profile name`}
            >
              <Text
                style={[
                  styles.senderName,
                  { color: colors.text },
                  compact && styles.commentSenderName,
                ]}
                numberOfLines={1}
              >
                {senderName}
              </Text>
            </TouchableOpacity>
            <View style={styles.roleRow}>
              <RoleIcon size={13} color={colors.textMuted} strokeWidth={2} />
              <Text
                style={[
                  styles.roleText,
                  { color: colors.textMuted },
                  compact && styles.commentRoleText,
                ]}
                numberOfLines={1}
              >
                {getRoleLabel(message.core.sender.kind)}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerTimeRow}>
              <Text
                style={[styles.timestamp, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {compact
                  ? formatRelative(message.core.createdAt)
                  : formatFeedDate(message.core.createdAt)}
              </Text>
              {!compact && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onMorePress?.(message)}
                  disabled={!onMorePress}
                  accessibilityLabel="More message actions"
                  hitSlop={8}
                >
                  <MoreVertical size={21} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
            {!compact ? (
              <View style={styles.visibilityBadgeSlot}>
                <VisibilityBadge message={message} colors={colors} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function getImageAttachments(message: MessageVM): ImageAttachmentVM[] {
  if (message.core.type !== 'image') return [];
  const imageMessage = message as ImageMessageVM;
  return imageMessage.attachments?.length
    ? imageMessage.attachments
    : imageMessage.attachment
      ? [imageMessage.attachment]
      : [];
}

function FeedImageGrid({
  message,
  onSendAnnotation,
}: {
  message: MessageVM;
  onSendAnnotation?: (attachment: AttachmentPayload) => void;
}) {
  const { colors } = useTheme();
  const attachments = getImageAttachments(message);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    const withPaths = attachments.filter((attachment) => attachment.storagePath);
    if (!withPaths.length) return;

    let cancelled = false;
    Promise.all(
      withPaths.map(async (attachment) => {
        const { data, error } = await supabase.storage
          .from(CHANNEL_FILES_BUCKET)
          .createSignedUrl(attachment.storagePath!, 3600);
        if (!error && data?.signedUrl) {
          return [attachment.storagePath!, data.signedUrl] as [string, string];
        }
        return null;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setSignedUrls(
        Object.fromEntries(entries.filter((entry): entry is [string, string] => !!entry)),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [attachments]);

  if (!attachments.length) return null;

  const sourceFor = (attachment: ImageAttachmentVM) =>
    attachment.storagePath
      ? (signedUrls[attachment.storagePath] ?? attachment.url)
      : attachment.url;
  const viewerItems: ChatImageViewerItem[] = attachments.map((attachment, index) => ({
    key: attachment.storagePath ?? attachment.url ?? `${message.ids.id}-${index}`,
    originalUrl: attachment.url,
    previewUrl: sourceFor(attachment),
    storagePath: attachment.storagePath ?? null,
    filename: attachment.name ?? null,
    mimeType: 'image/*',
  }));
  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  if (attachments.length === 1) {
    const first = attachments[0]!;
    return (
      <>
        <TouchableOpacity
          testID="feed-image-grid-single"
          style={styles.singleImageWrap}
          activeOpacity={0.9}
          onPress={() => openViewer(0)}
          accessibilityLabel={`View ${first.name} full size`}
        >
          <Image
            source={{ uri: sourceFor(first) }}
            style={styles.singleImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <ChatImageViewer
          visible={viewerVisible}
          items={viewerItems}
          initialIndex={viewerIndex}
          colors={colors}
          onClose={() => setViewerVisible(false)}
          onSend={onSendAnnotation}
        />
      </>
    );
  }

  if (attachments.length === 2) {
    return (
      <View testID="feed-image-grid-two" style={styles.twoImageGrid}>
        {attachments.map((attachment, index) => (
          <TouchableOpacity
            key={`${attachment.storagePath ?? attachment.url}-${index}`}
            style={styles.twoImage}
            activeOpacity={0.9}
            onPress={() => openViewer(index)}
            accessibilityLabel={`View ${attachment.name} full size`}
          >
            <Image
              source={{ uri: sourceFor(attachment) }}
              style={styles.mediaFill}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
        <ChatImageViewer
          visible={viewerVisible}
          items={viewerItems}
          initialIndex={viewerIndex}
          colors={colors}
          onClose={() => setViewerVisible(false)}
          onSend={onSendAnnotation}
        />
      </View>
    );
  }

  const visible = attachments.slice(0, 5);
  const overflow = Math.max(0, attachments.length - 4);
  return (
    <View testID="feed-image-grid-collage" style={styles.collageGrid}>
      <TouchableOpacity
        style={styles.collageLarge}
        activeOpacity={0.9}
        onPress={() => openViewer(0)}
        accessibilityLabel={`View ${visible[0]!.name} full size`}
      >
        <Image
          source={{ uri: sourceFor(visible[0]!) }}
          style={styles.mediaFill}
          resizeMode="cover"
        />
      </TouchableOpacity>
      <View style={styles.collageSmallGrid}>
        {visible.slice(1, 5).map((attachment, index) => {
          const isOverflowTile = index === 3 && overflow > 0;
          return (
            <TouchableOpacity
              key={`${attachment.storagePath ?? attachment.url}-${index}`}
              style={styles.collageSmallWrap}
              activeOpacity={0.9}
              onPress={() => openViewer(index + 1)}
              accessibilityLabel={`View ${attachment.name} full size`}
            >
              <Image
                source={{ uri: sourceFor(attachment) }}
                style={styles.collageSmall}
                resizeMode="cover"
              />
              {isOverflowTile ? (
                <View style={styles.overflowOverlay}>
                  <Text style={styles.overflowText}>{`${overflow}+`}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <ChatImageViewer
        visible={viewerVisible}
        items={viewerItems}
        initialIndex={viewerIndex}
        colors={colors}
        onClose={() => setViewerVisible(false)}
        onSend={onSendAnnotation}
      />
    </View>
  );
}

function getFileAttachments(message: MessageVM): FileAttachmentVM[] {
  if (message.core.type !== 'file') return [];
  const fileMessage = message as FileMessageVM;
  return fileMessage.attachments?.length
    ? fileMessage.attachments
    : fileMessage.attachment
      ? [fileMessage.attachment]
      : [];
}

function FeedFileAttachments({
  message,
  onSendAnnotation,
}: {
  message: MessageVM;
  onSendAnnotation?: (attachment: AttachmentPayload) => void;
}) {
  const { colors } = useTheme();
  const attachments = getFileAttachments(message);
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [pdfViewerDocument, setPdfViewerDocument] = useState<{
    url: string;
    storagePath?: string | null;
    filename?: string | null;
  } | null>(null);

  const handleOpen = useCallback(
    async (attachment: FileAttachmentVM) => {
      const key = attachment.storagePath ?? attachment.url;
      if (openingFile === key) return;
      if (isPdfAttachment(attachment)) {
        setPdfViewerDocument({
          url: attachment.url,
          storagePath: attachment.storagePath,
          filename: attachment.name,
        });
        return;
      }
      setOpeningFile(key);
      try {
        let openUrl = attachment.url;
        if (attachment.storagePath) {
          const { data, error } = await supabase.storage
            .from(CHANNEL_FILES_BUCKET)
            .createSignedUrl(attachment.storagePath, 300);
          if (error || !data?.signedUrl) throw new Error();
          openUrl = data.signedUrl;
        }
        await WebBrowser.openBrowserAsync(openUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      } catch {
        await Linking.openURL(attachment.url).catch(() => null);
      } finally {
        setOpeningFile(null);
      }
    },
    [openingFile],
  );

  if (!attachments.length) return null;

  return (
    <>
      <View
        style={[
          styles.fileCard,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        {attachments.map((attachment, index) => {
          const key = attachment.storagePath ?? attachment.url;
          const isOpening = openingFile === key;
          return (
            <TouchableOpacity
              key={`${key}-${index}`}
              style={[
                styles.fileRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
              activeOpacity={0.75}
              disabled={isOpening}
              onPress={() => handleOpen(attachment)}
              accessibilityLabel={`Open ${attachment.name}`}
            >
              <View style={[styles.fileIcon, { backgroundColor: colors.tealBg }]}>
                {isOpening ? (
                  <ActivityIndicator size="small" color={colors.teal} />
                ) : (
                  <FileText size={20} color={colors.teal} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {attachment.name}
                </Text>
                {!!attachment.size && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                    {formatFileSize(attachment.size)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {!!pdfViewerDocument && (
        <ChatPdfViewer
          visible={!!pdfViewerDocument}
          url={pdfViewerDocument.url}
          storagePath={pdfViewerDocument.storagePath}
          filename={pdfViewerDocument.filename}
          colors={colors}
          onClose={() => setPdfViewerDocument(null)}
          onSend={onSendAnnotation}
        />
      )}
    </>
  );
}

function FeedLinkPreview({ message }: { message: MessageVM }) {
  const { colors } = useTheme();
  if (message.core.type !== 'link-preview') return null;
  const linkMessage = message as LinkPreviewMessageVM;
  if (!linkMessage.link) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[
        styles.linkCard,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
      onPress={() => Linking.openURL(linkMessage.link.url).catch(() => null)}
      accessibilityLabel={`Open link: ${linkMessage.link.title}`}
    >
      {!!linkMessage.link.imageUrl && (
        <Image
          source={{ uri: linkMessage.link.imageUrl }}
          style={styles.linkImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.linkBody}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.linkTitle, { color: colors.text }]} numberOfLines={1}>
            {linkMessage.link.title}
          </Text>
          {!!linkMessage.link.description && (
            <Text
              style={[styles.linkDescription, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {linkMessage.link.description}
            </Text>
          )}
          <Text style={[styles.linkSite, { color: colors.textFaint }]} numberOfLines={1}>
            {linkMessage.link.siteName || linkMessage.link.url}
          </Text>
        </View>
        <ExternalLink size={17} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function FeedAudioPlayer({ message }: { message: AudioRecordingMessageVM }) {
  const { colors } = useTheme();
  const audioMessage = message as AudioRecordingMessageVM;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(
    (audioMessage.audio.durationSeconds ?? 0) * 1000,
  );
  const playerRef = React.useRef<AudioPlayer | null>(null);
  const subRef = React.useRef<{ remove(): void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storagePath = audioMessage.audio.storagePath;
    if (!storagePath) return;
    supabase.storage
      .from(CHANNEL_FILES_BUCKET)
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [audioMessage.audio.storagePath]);

  useEffect(
    () => () => {
      subRef.current?.remove();
      playerRef.current?.pause();
      playerRef.current?.remove?.();
    },
    [],
  );

  const handlePress = useCallback(async () => {
    const url = signedUrl ?? audioMessage.audio.url;
    if (!url) return;
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
      return;
    }
    setLoading(true);
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      const player = createAudioPlayer({ uri: url });
      subRef.current = player.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => {
          setIsPlaying(status.playing);
          setPositionMs(Math.round(status.currentTime * 1000));
          if (status.duration) setDurationMs(Math.round(status.duration * 1000));
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPositionMs(0);
          }
        },
      );
      playerRef.current = player;
      player.play();
      setIsPlaying(true);
    } finally {
      setLoading(false);
    }
  }, [audioMessage.audio.url, isPlaying, signedUrl]);

  const waveform =
    audioMessage.audio.waveform?.slice(0, 28) ??
    Array.from({ length: 28 }, (_, index) =>
      Math.max(0.28, Math.sin(((index + 2) / 28) * Math.PI) * 0.5 + 0.45),
    );
  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const isUnsupportedOnIOS =
    Platform.OS === 'ios' &&
    (audioMessage.audio.mimeType?.includes('webm') ||
      audioMessage.audio.mimeType?.includes('ogg'));

  return (
    <View
      style={[
        styles.audioCard,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      {isUnsupportedOnIOS ? (
        <Text style={styles.unsupportedAudioText}>
          This audio format is not supported on iPhone
        </Text>
      ) : null}
      <View style={styles.audioRow}>
        <TouchableOpacity
          style={[
            styles.playButton,
            {
              backgroundColor: isPlaying ? colors.teal : colors.tealBg,
              borderColor: colors.teal + '33',
            },
          ]}
          onPress={handlePress}
          disabled={loading}
          accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : isPlaying ? (
            <Pause size={15} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play
              size={15}
              color={colors.teal}
              fill={colors.teal}
              style={{ marginLeft: 2 }}
            />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={styles.audioTimeRow}>
            <Text style={[styles.audioTime, { color: colors.textFaint }]}>
              {formatMs(positionMs)}
            </Text>
            <Text style={[styles.audioTime, { color: colors.textFaint }]}>
              {formatMs(durationMs)}
            </Text>
          </View>
          <View style={styles.waveformRow}>
            {waveform.map((value, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: Math.max(8, Math.round(value * 16)),
                  borderRadius: 99,
                  backgroundColor:
                    index / waveform.length <= progress ? colors.teal : colors.border,
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function FeedContentCard({
  message,
  compact = false,
  isOwn = false,
}: {
  message: MessageVM;
  compact?: boolean;
  isOwn?: boolean;
}) {
  const { colors } = useTheme();
  let text = getMessageText(message);
  if (message.core.type === 'link-preview') {
    const link = (message as LinkPreviewMessageVM).link;
    text = link ? text.replace(link.url, '').trim() : text;
  }
  if (!text) return null;
  const emojiOnly = isEmojiOnlyText(text);
  return (
    <View
      testID="feed-text-card"
      style={[
        styles.textCard,
        isOwn ? styles.ownBubbleCard : styles.otherBubbleCard,
        compact && styles.commentTextCard,
      ]}
    >
      <View style={styles.captionTextWrap}>
        <FeedText
          text={text}
          mentions={getMentions(message)}
          size={emojiOnly ? FONT.emoji : undefined}
          lineHeight={emojiOnly ? FONT.emojiLine : undefined}
          color={colors.text}
          mentionColor={colors.teal}
        />
      </View>
    </View>
  );
}

function FeedActions({
  message,
  onReactionToggle,
  onThreadPress,
  disabled,
  compact = false,
  hideReplyButton = false,
}: {
  message: MessageVM;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
  hideReplyButton?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={compact ? styles.commentActionsRow : styles.actionsRow}>
      <SocialBar
        reactions={message.social.reactions ?? []}
        thread={message.social.thread ?? null}
        threadUnreadCount={message.social.thread?.readState?.unreadCount}
        messageId={message.ids.id}
        colors={colors}
        onReactionToggle={disabled ? undefined : onReactionToggle}
        onThreadPress={onThreadPress}
        threadExpanded={false}
        disabledActions={disabled ?? false}
        hideThreadButton={hideReplyButton}
        replyButtonLabel={!compact ? 'Reply' : undefined}
      />
    </View>
  );
}

function FeedComment({
  message,
  currentProfileId,
  onReactionToggle,
  onThreadPress,
  onProfilePress,
  onLongPress,
  isReadOnly,
  presenceStatus,
}: {
  message: MessageVM;
  currentProfileId?: string;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadPress?: () => void;
  onProfilePress?: (user: MessageVM['core']['sender']) => void;
  onLongPress?: (message: MessageVM) => void;
  isReadOnly?: boolean;
  presenceStatus?: PresenceDisplayStatus | null;
}) {
  const { colors } = useTheme();
  const senderName = message.core.sender.profile.displayName;
  const { url, seed } = getAvatarInfo(message);
  const handleProfilePress = () => onProfilePress?.(message.core.sender);
  const isOwn = Boolean(
    currentProfileId && message.core.sender.ids.id === currentProfileId,
  );
  return (
    <Pressable
      testID="feed-comment-card"
      style={styles.commentRow}
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={350}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={handleProfilePress}
        disabled={!onProfilePress}
        accessibilityLabel={`${senderName} profile avatar`}
      >
        <MessageAvatar
          name={senderName}
          src={url}
          seed={seed}
          role={message.core.sender.kind}
          presence={message.core.sender.presence}
          presenceStatus={presenceStatus}
          size={FEED.commentAvatar}
          badgeSizeOverride={14}
        />
      </TouchableOpacity>
      <View style={styles.commentBody}>
        <View
          testID="feed-comment-bubble"
          style={[
            styles.commentCard,
            isOwn ? styles.ownBubbleCard : styles.otherBubbleCard,
          ]}
        >
          <View style={styles.commentHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleProfilePress}
                disabled={!onProfilePress}
                accessibilityLabel={`${senderName} profile name`}
              >
                <Text
                  style={[styles.commentSenderName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {senderName}
                </Text>
              </TouchableOpacity>
              <Text
                style={[styles.commentRoleText, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {getRoleLabel(message.core.sender.kind)}
              </Text>
            </View>
            <Text
              style={[styles.commentTimestamp, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {formatRelative(message.core.createdAt)}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onLongPress?.(message)}
              disabled={!onLongPress}
              accessibilityLabel="More message actions"
              hitSlop={8}
            >
              <MoreVertical size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.commentTextWrap}>
            <FeedText
              text={getMessageText(message)}
              mentions={getMentions(message)}
              color={colors.text}
              mentionColor={colors.teal}
            />
          </View>
        </View>
        <FeedActions
          message={message}
          compact
          disabled={isReadOnly}
          onReactionToggle={onReactionToggle}
          onThreadPress={onThreadPress}
        />
      </View>
    </Pressable>
  );
}

function FeedPost({
  message,
  presenceByProfileId,
  showUnreadDot,
  channelId,
  currentProfileId,
  currentAccountId,
  onReactionToggle,
  onThreadOpen,
  onProfilePress,
  onLongPress,
  onSendAnnotation,
  isReadOnly,
}: {
  message: MessageVM;
  presenceByProfileId: Map<string, PresenceDisplayStatus>;
  showUnreadDot?: boolean;
  channelId?: string;
  currentProfileId: string;
  currentAccountId?: string;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadOpen?: (message: MessageVM) => void;
  onProfilePress?: (user: MessageVM['core']['sender']) => void;
  onLongPress?: (message: MessageVM) => void;
  onSendAnnotation?: (attachment: AttachmentPayload) => void;
  isReadOnly?: boolean;
}) {
  const { colors } = useTheme();
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [threadReplies, setThreadReplies] = useState<MessageVM[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadUnreadCount, setThreadUnreadCount] = useState(
    message.social.thread?.readState?.unreadCount ?? 0,
  );
  const thread = message.social.thread ?? null;
  const { markThreadRead } = useMarkRead({
    orgId: message.ids.orgId,
    profileId: currentProfileId,
    accountId: currentAccountId ?? '',
    channelId: channelId ?? thread?.readState?.channelId ?? '',
  });

  const senderPresenceStatus =
    presenceByProfileId.get(message.core.sender.ids.id) ?? null;
  const inlineUnreadStartIndex = findInlineUnreadStartIndex({
    replies: threadReplies,
    lastReadMessageId: thread?.readState?.lastReadMessageId,
    unreadCount: threadUnreadCount,
    currentUserId: currentProfileId,
  });

  useEffect(() => {
    setThreadUnreadCount(thread?.readState?.unreadCount ?? 0);
  }, [thread?.ids.id, thread?.readState?.unreadCount]);

  useEffect(() => {
    if (!threadExpanded || !thread) return;
    let cancelled = false;
    setThreadLoading(true);
    fetchThreadMessages(
      message.ids.orgId,
      thread.readState?.channelId ?? channelId ?? '',
      thread.ids.id,
      message.ids.id,
      currentProfileId,
      currentAccountId ?? '',
    )
      .then(async (replies) => {
        if (cancelled) return;
        setThreadReplies(replies);
        const resolvedChannelId = thread.readState?.channelId ?? channelId ?? '';
        const lastReplyId = replies[replies.length - 1]?.ids.id ?? null;
        if (resolvedChannelId && currentProfileId && currentAccountId) {
          const alreadyUpToDate =
            threadUnreadCount === 0 &&
            lastReplyId === thread.readState?.lastReadMessageId;
          if (!alreadyUpToDate) {
            await markThreadRead({
              orgId: message.ids.orgId,
              channelId: resolvedChannelId,
              parentMessageId: message.ids.id,
              threadId: thread.ids.id,
              lastReadMessageId: lastReplyId,
            });
            if (!cancelled) setThreadUnreadCount(0);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    channelId,
    currentAccountId,
    currentProfileId,
    markThreadRead,
    message.ids.id,
    message.ids.orgId,
    thread,
    threadExpanded,
    threadUnreadCount,
  ]);

  const handleThreadPress = () => {
    if (!thread) {
      onThreadOpen?.(message);
      return;
    }
    setThreadExpanded((value) => !value);
  };

  const handleThreadReplyReactionToggle = useCallback(
    (messageId: string, emoji: string) => {
      setThreadReplies((replies) =>
        replies.map((reply) =>
          reply.ids.id === messageId
            ? {
                ...reply,
                social: {
                  ...reply.social,
                  reactions: applyOptimisticReaction(
                    reply.social?.reactions,
                    emoji,
                    currentAccountId,
                  ),
                },
              }
            : reply,
        ),
      );
      onReactionToggle?.(messageId, emoji);
    },
    [currentAccountId, onReactionToggle],
  );

  return (
    <Pressable
      testID="feed-message-post"
      style={[styles.post, { borderColor: colors.border, backgroundColor: colors.card }]}
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={350}
    >
      {showUnreadDot ? (
        <View
          testID="feed-unread-dot"
          style={[styles.unreadDot, { backgroundColor: colors.teal }]}
        />
      ) : null}
      <FeedHeader
        message={message}
        presenceStatus={senderPresenceStatus}
        onProfilePress={onProfilePress}
        onMorePress={onLongPress}
      />
      <View style={styles.postBody}>
        {isRichMessageType(message.core.type) ? (
          <RichMessageContent message={message} colors={colors} />
        ) : null}
        {!isRichMessageType(message.core.type) ? (
          <FeedImageGrid message={message} onSendAnnotation={onSendAnnotation} />
        ) : null}
        {!isRichMessageType(message.core.type) ? (
          <FeedFileAttachments message={message} onSendAnnotation={onSendAnnotation} />
        ) : null}
        {!isRichMessageType(message.core.type) && message.core.type === 'link-preview' ? (
          <FeedLinkPreview message={message} />
        ) : null}
        {!isRichMessageType(message.core.type) &&
        message.core.type === 'audio-recording' ? (
          <FeedAudioPlayer message={message as AudioRecordingMessageVM} />
        ) : null}
        {!isRichMessageType(message.core.type) ? (
          <FeedContentCard
            message={message}
            isOwn={message.core.sender.ids.id === currentProfileId}
          />
        ) : null}
        <FeedActions
          message={message}
          disabled={isReadOnly}
          onReactionToggle={onReactionToggle}
          onThreadPress={handleThreadPress}
        />
        {threadExpanded ? (
          <View style={styles.commentsWrap}>
            {threadLoading ? (
              <ActivityIndicator size="small" color={colors.teal} />
            ) : (
              <>
                {threadReplies.map((reply) => (
                  <React.Fragment key={reply.ids.id}>
                    {inlineUnreadStartIndex >= 0 &&
                    threadReplies[inlineUnreadStartIndex]?.ids.id === reply.ids.id ? (
                      <View
                        testID="feed-thread-unread-dot"
                        style={[styles.threadUnreadDot, { backgroundColor: colors.teal }]}
                      />
                    ) : null}
                    <FeedComment
                      message={reply}
                      currentProfileId={currentProfileId}
                      presenceStatus={
                        presenceByProfileId.get(reply.core.sender.ids.id) ?? null
                      }
                      onReactionToggle={handleThreadReplyReactionToggle}
                      onThreadPress={() => onThreadOpen?.(message)}
                      onProfilePress={onProfilePress}
                      onLongPress={onLongPress}
                      isReadOnly={isReadOnly}
                    />
                  </React.Fragment>
                ))}
              </>
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export const FeedMessageList: React.FC<FeedMessageListProps> = ({
  messages,
  channelId,
  currentProfileId,
  currentAccountId,
  onLoadMore,
  loading = false,
  refreshing = false,
  onRefresh,
  onReactionToggle,
  onThreadOpen,
  onProfilePress,
  onMessageLongPress,
  pendingUploads,
  onRetryUpload,
  isReadOnly,
  onUnreadViewed,
  isScreenActive = true,
  emptyTitle,
  emptyDescription,
  lastReadMessageId,
  lastReadAt,
  unreadCount,
  onSendAnnotation,
}) => {
  const { colors } = useTheme();
  const flatListRef = React.useRef<FlatList<MessageVM>>(null);
  const didInitialScrollRef = React.useRef(false);
  const latestMessageIdRef = React.useRef<string | undefined>(undefined);
  const isLoadingOlderRef = React.useRef(false);
  const pendingScrollToLatestRef = React.useRef(false);
  const scrollOffsetRef = React.useRef(0);
  const contentHeightRef = React.useRef(0);
  const reactionStartContentHeightRef = React.useRef(0);
  const preserveOffsetAfterReactionRef = React.useRef(false);
  const isNearLatestRef = React.useRef(true);
  const [preserveVisibleContent, setPreserveVisibleContent] = useState(false);
  const sortedMessages = useMemo(
    () =>
      [...messages]
        .filter(
          (message) =>
            !message.social.thread?.parent.messageId ||
            message.social.thread.parent.messageId === message.ids.id,
        )
        .sort(
          (a, b) =>
            new Date(a.core.createdAt).getTime() - new Date(b.core.createdAt).getTime(),
        ),
    [messages],
  );
  const latestIncomingMessageId = useMemo(
    () =>
      findLatestUnreadIncomingMessageId({
        messages: sortedMessages,
        lastReadMessageId,
        lastReadAt,
        unreadCount,
        currentProfileId,
      }),
    [currentProfileId, lastReadAt, lastReadMessageId, sortedMessages, unreadCount],
  );
  const unreadStartMessageId = useMemo(
    () =>
      findUnreadStartMessageId({
        messages: sortedMessages,
        lastReadMessageId,
        lastReadAt,
        unreadCount,
        currentProfileId,
      }),
    [currentProfileId, lastReadAt, lastReadMessageId, sortedMessages, unreadCount],
  );
  const unreadStartIndex = useMemo(
    () =>
      unreadStartMessageId
        ? sortedMessages.findIndex((message) => message.ids.id === unreadStartMessageId)
        : -1,
    [sortedMessages, unreadStartMessageId],
  );
  const orgId = sortedMessages[0]?.ids.orgId ?? messages[0]?.ids.orgId ?? '';
  const participantProfileIds = useMemo(
    () => messages.map((message) => message.core.sender.ids.id),
    [messages],
  );
  const presenceByProfileId = useOnlineProfileIds(
    orgId,
    currentProfileId,
    participantProfileIds,
  );

  useEffect(() => {
    if (!onUnreadViewed || !latestIncomingMessageId || !isScreenActive || isReadOnly)
      return;
    if (AppState.currentState !== 'active') return;
    onUnreadViewed(latestIncomingMessageId);
  }, [isReadOnly, isScreenActive, latestIncomingMessageId, onUnreadViewed]);

  const scrollToLatest = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
      pendingScrollToLatestRef.current = false;
      didInitialScrollRef.current = true;
    });
  }, []);

  useEffect(() => {
    const latestMessageId = sortedMessages[sortedMessages.length - 1]?.ids.id;
    if (!latestMessageId) {
      latestMessageIdRef.current = undefined;
      didInitialScrollRef.current = false;
      pendingScrollToLatestRef.current = false;
      return;
    }

    const shouldScrollToLatest =
      !didInitialScrollRef.current || latestMessageId !== latestMessageIdRef.current;

    latestMessageIdRef.current = latestMessageId;

    if (!shouldScrollToLatest) {
      return;
    }

    pendingScrollToLatestRef.current = true;
    scrollToLatest(didInitialScrollRef.current);
  }, [scrollToLatest, sortedMessages]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      scrollOffsetRef.current = contentOffset.y;
      isNearLatestRef.current =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
      if (!didInitialScrollRef.current) return;
      if (!onLoadMore || isLoadingOlderRef.current) return;
      if (contentOffset.y > 40) return;

      isLoadingOlderRef.current = true;
      setPreserveVisibleContent(true);
      requestAnimationFrame(() => {
        Promise.resolve(onLoadMore()).finally(() => {
          requestAnimationFrame(() => {
            isLoadingOlderRef.current = false;
            setPreserveVisibleContent(false);
          });
        });
      });
    },
    [onLoadMore],
  );

  const handleReactionToggle = useCallback(
    (messageId: string, emoji: string) => {
      preserveOffsetAfterReactionRef.current = true;
      reactionStartContentHeightRef.current = contentHeightRef.current;
      pendingScrollToLatestRef.current = false;
      onReactionToggle?.(messageId, emoji);
    },
    [onReactionToggle],
  );

  const emptyNode: ReactNode = (
    <View style={[styles.emptyWrap, { backgroundColor: colors.pageBg }]}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {emptyTitle ?? 'Start the conversation'}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>
        {emptyDescription ?? 'Share an update or question to begin the discussion.'}
      </Text>
    </View>
  );

  if (!loading && sortedMessages.length === 0 && !pendingUploads?.length) {
    return emptyNode;
  }

  const footerNode: ReactNode =
    pendingUploads?.length || loading ? (
      <View>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.teal} />
          </View>
        ) : null}
        {pendingUploads?.length ? (
          <View style={{ paddingVertical: 8 }}>
            {pendingUploads.map((pending) => (
              <PendingMessageRow
                key={pending.id}
                pending={pending}
                colors={colors}
                onRetry={() => onRetryUpload?.(pending.id)}
              />
            ))}
          </View>
        ) : null}
      </View>
    ) : null;

  return (
    <FlatList
      ref={flatListRef}
      testID="feed-message-list"
      data={sortedMessages}
      keyExtractor={(item) => item.ids.id}
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      contentContainerStyle={[styles.listContent, { backgroundColor: colors.pageBg }]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
          />
        ) : undefined
      }
      onScroll={handleScroll}
      scrollEventThrottle={120}
      onLayout={() => {
        if (pendingScrollToLatestRef.current) {
          scrollToLatest(didInitialScrollRef.current);
        }
      }}
      onContentSizeChange={(_, contentHeight) => {
        if (preserveOffsetAfterReactionRef.current) {
          preserveOffsetAfterReactionRef.current = false;
          const offset = scrollOffsetRef.current;
          const previousContentHeight = reactionStartContentHeightRef.current;
          contentHeightRef.current = contentHeight;
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, offset),
              animated: false,
            });
          });
          if (isNearLatestRef.current && contentHeight > previousContentHeight) {
            scrollToLatest(false);
          }
          return;
        }
        const previousContentHeight = contentHeightRef.current;
        contentHeightRef.current = contentHeight;
        if (pendingScrollToLatestRef.current) {
          scrollToLatest(didInitialScrollRef.current);
          return;
        }
        if (isNearLatestRef.current && contentHeight > previousContentHeight) {
          scrollToLatest(false);
        }
      }}
      maintainVisibleContentPosition={
        preserveVisibleContent ? { minIndexForVisible: 0 } : undefined
      }
      renderItem={({ item }) => (
        <FeedPost
          message={item}
          presenceByProfileId={presenceByProfileId}
          showUnreadDot={
            unreadStartIndex >= 0 &&
            sortedMessages.findIndex((message) => message.ids.id === item.ids.id) >=
              unreadStartIndex &&
            item.core.sender.ids.id !== currentProfileId
          }
          channelId={channelId}
          currentProfileId={currentProfileId}
          currentAccountId={currentAccountId}
          onReactionToggle={handleReactionToggle}
          onThreadOpen={onThreadOpen}
          onProfilePress={onProfilePress}
          onLongPress={onMessageLongPress}
          onSendAnnotation={onSendAnnotation}
          isReadOnly={isReadOnly}
        />
      )}
      ListFooterComponent={footerNode}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: FEED.gap,
    paddingTop: 14,
    paddingBottom: 22,
  },
  post: {
    position: 'relative',
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FEED.border,
    borderColor: FEED.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 4,
  },
  headerTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visibilityBadgeSlot: {
    minHeight: 18,
    alignItems: 'flex-end',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FEED.blue,
  },
  senderNameButton: {
    flexShrink: 1,
    minWidth: 0,
  },
  senderName: {
    color: FEED.text,
    fontSize: FONT.title,
    lineHeight: FONT.titleLine,
    fontWeight: '700',
  },
  commentSenderName: {
    fontSize: FONT.title,
    lineHeight: FONT.titleLine,
  },
  timestamp: {
    color: FEED.muted,
    fontSize: FONT.meta,
    lineHeight: FONT.metaLine,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  roleText: {
    color: FEED.muted,
    fontSize: FONT.meta,
    lineHeight: FONT.metaLine,
  },
  commentRoleText: {
    fontSize: FONT.small,
    lineHeight: FONT.smallLine,
  },
  postBody: {
    marginTop: 16,
    gap: 12,
  },
  singleImageWrap: {
    overflow: 'hidden',
    borderRadius: FEED.radius,
  },
  singleImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: FEED.radius,
  },
  twoImageGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  twoImage: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: FEED.radius,
    overflow: 'hidden',
  },
  mediaFill: {
    width: '100%',
    height: '100%',
  },
  collageGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  collageLarge: {
    flex: 1,
    aspectRatio: 0.78,
    borderRadius: FEED.radius,
    overflow: 'hidden',
  },
  collageSmallGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  collageSmallWrap: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: FEED.radius,
    overflow: 'hidden',
  },
  collageSmall: {
    width: '100%',
    height: '100%',
  },
  overflowOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,41,55,0.55)',
  },
  overflowText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  textCard: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  otherBubbleCard: {
    backgroundColor: FEED.bubbleOther,
  },
  ownBubbleCard: {
    backgroundColor: FEED.bubbleOwn,
  },
  feedText: {
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
    color: FEED.text,
  },
  captionTextWrap: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  commentTextCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fileCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  linkImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  linkBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  linkDescription: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  linkSite: {
    marginTop: 6,
    fontSize: 12,
  },
  audioCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  audioTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  audioTime: {
    fontSize: 12,
  },
  unsupportedAudioText: {
    marginBottom: 8,
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  waveformRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionsRow: {
    minHeight: 34,
  },
  commentActionsRow: {
    marginTop: 8,
  },
  commentsWrap: {
    gap: 12,
    paddingTop: 8,
  },
  threadUnreadDot: {
    alignSelf: 'center',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FEED.blue,
    marginVertical: 2,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  commentBody: {
    flex: 1,
    gap: 0,
  },
  commentCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentTimestamp: {
    color: FEED.muted,
    fontSize: FONT.small,
    lineHeight: FONT.smallLine,
  },
  commentTextWrap: {
    marginTop: 12,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: FEED.page,
  },
  emptyTitle: {
    color: FEED.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    marginTop: 8,
    color: FEED.muted,
    fontSize: FONT.meta,
    lineHeight: FONT.metaLine,
    textAlign: 'center',
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
