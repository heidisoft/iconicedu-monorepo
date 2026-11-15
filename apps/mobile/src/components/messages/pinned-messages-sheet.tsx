import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { Pin, PinOff, X } from 'lucide-react-native';
import type { MessageVM, TextMessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { fetchPinnedMessages, toggleMessagePin } from '@/lib/api/queries';
import { getInitials } from './message-item';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';

// ─── Pinning (issue #264 P2) ────────────────────────────────────────────────

type PinnedRow = {
  message: MessageVM;
  pinnedByName: string;
  pinnedAt: string;
};

function extractPinnerName(pinnedBy: unknown): string {
  if (pinnedBy && typeof pinnedBy === 'object') {
    const profile = (
      pinnedBy as { profile?: { displayName?: string; firstName?: string } }
    ).profile;
    const name = profile?.displayName?.trim() || profile?.firstName?.trim();
    if (name) return name;
  }
  return 'Someone';
}

function getMessagePreview(message: MessageVM): string {
  switch (message.core.type) {
    case 'text':
      return (message as TextMessageVM).content.text;
    case 'image':
      return 'Photo';
    case 'file':
      return (
        (message as unknown as { attachment?: { name?: string } }).attachment?.name ??
        'File'
      );
    case 'audio-recording':
      return 'Voice message';
    default:
      return 'Message';
  }
}

function formatPinnedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export type PinnedMessagesSheetProps = {
  visible: boolean;
  orgId: string;
  channelId: string;
  profileId: string;
  accountId: string;
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.modalOverlay },
    sheet: {
      backgroundColor: C.pageBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '80%',
      paddingBottom: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
    },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: C.text },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { fontWeight: '700', fontSize: 14 },
    body: { flex: 1, gap: 2 },
    meta: { fontSize: 12, color: C.textMuted },
    preview: { fontSize: 15, color: C.text, lineHeight: 20 },
    unpinBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.tealBg,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text },
    emptyDesc: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  });
}

export function PinnedMessagesSheet({
  visible,
  orgId,
  channelId,
  profileId,
  accountId,
  onClose,
  onJumpToMessage,
}: PinnedMessagesSheetProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [rows, setRows] = useState<PinnedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId || !channelId) return;
    setLoading(true);
    try {
      const pins = await fetchPinnedMessages({ orgId, channelId, profileId, accountId });
      setRows(
        pins.map((p) => ({
          message: p.message,
          pinnedByName: extractPinnerName(p.pinnedBy),
          pinnedAt: p.pinnedAt,
        })),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, channelId, profileId, accountId]);

  useEffect(() => {
    if (visible) {
      void load();
    }
  }, [visible, load]);

  const handleUnpin = useCallback(
    async (messageId: string) => {
      setUnpinningId(messageId);
      try {
        await toggleMessagePin({
          orgId,
          channelId,
          messageId,
          isPinned: false,
          profileId,
        });
        setRows((prev) => prev.filter((r) => r.message.ids.id !== messageId));
      } catch (error) {
        Alert.alert(
          'Unable to unpin message',
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        );
      } finally {
        setUnpinningId(null);
      }
    },
    [orgId, channelId, profileId],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Pinned messages</Text>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={onClose}
              accessibilityLabel="Close pinned messages"
            >
              <X size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.emptyState}>
              <ActivityIndicator size="large" color={colors.teal} />
            </View>
          ) : rows.length === 0 ? (
            <View style={s.emptyState}>
              <Pin size={28} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No pinned messages</Text>
              <Text style={s.emptyDesc}>
                Pin important messages so everyone can find them quickly.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {rows.map((row) => {
                const senderName = row.message.core.sender.profile.displayName;
                const avatarColors = profileAvatarColors({ seed: senderName });
                return (
                  <TouchableOpacity
                    key={row.message.ids.id}
                    style={s.row}
                    activeOpacity={0.7}
                    onPress={() => {
                      onJumpToMessage?.(row.message.ids.id);
                      onClose();
                    }}
                  >
                    <View style={[s.avatar, { backgroundColor: avatarColors.bg }]}>
                      <Text style={[s.avatarTxt, { color: avatarColors.fg }]}>
                        {getInitials(senderName)}
                      </Text>
                    </View>
                    <View style={s.body}>
                      <Text style={s.meta}>
                        Pinned by {row.pinnedByName} · {formatPinnedAt(row.pinnedAt)}
                      </Text>
                      <Text style={s.preview} numberOfLines={2}>
                        {getMessagePreview(row.message)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.unpinBtn}
                      disabled={unpinningId === row.message.ids.id}
                      onPress={() => {
                        void handleUnpin(row.message.ids.id);
                      }}
                      accessibilityLabel="Unpin message"
                    >
                      {unpinningId === row.message.ids.id ? (
                        <ActivityIndicator size="small" color={colors.teal} />
                      ) : (
                        <PinOff size={16} color={colors.teal} />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
