import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { fetchThreadMessages } from '@/lib/api/queries';
import { MessageItem } from './message-item';
import { MessageInput } from './message-input';

type ThreadSheetProps = {
  visible: boolean;
  parentMessage: MessageVM | null;
  currentProfileId: string;
  currentAccountId: string;
  onClose: () => void;
  /**
   * threadParentId = the parent message's ids.id
   * threadId = the threads table row id (ThreadVM.ids.id) — set when the thread exists
   */
  onSend: (text: string, threadParentId: string, threadId?: string) => Promise<void>;
  onReactionToggle?: (messageId: string, emoji: string) => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.pageBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: '88%',
      overflow: 'hidden',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginTop: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: C.text },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeTxt: { fontSize: 16, color: C.textMuted },
    parentSection: {
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.inputBg,
      paddingVertical: 4,
    },
    repliesHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textMuted,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    emptyTxt: { fontSize: 13, color: C.textFaint },
  });
}

export const ThreadSheet: React.FC<ThreadSheetProps> = ({
  visible,
  parentMessage,
  currentProfileId,
  currentAccountId,
  onClose,
  onSend,
  onReactionToggle,
}) => {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const [replies, setReplies] = useState<MessageVM[]>([]);
  const [loading, setLoading] = useState(false);

  // threads.id from the loaded ThreadVM — used as the preferred fetch key
  const threadId = parentMessage?.social?.thread?.ids.id;

  const loadReplies = useCallback(async () => {
    if (!parentMessage) return;
    setLoading(true);
    try {
      // Pass both threadId (preferred, threads table FK) and parentMessageId (fallback)
      const data = await fetchThreadMessages(
        threadId ?? parentMessage.ids.id, // threadId when available
        parentMessage.ids.id, // always the parent message id
        currentProfileId,
        currentAccountId,
      );
      setReplies(data);
    } catch (err) {
      console.warn('[ThreadSheet] loadReplies error:', err);
    } finally {
      setLoading(false);
    }
  }, [parentMessage, threadId, currentProfileId, currentAccountId]);

  useEffect(() => {
    if (visible && parentMessage) {
      loadReplies();
    } else {
      setReplies([]);
    }
  }, [visible, parentMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(
    async (text: string) => {
      if (!parentMessage) return;
      // Pass threadId so sendTextMessage can set messages.thread_id correctly
      await onSend(text, parentMessage.ids.id, threadId);
      loadReplies();
    },
    [parentMessage, threadId, onSend, loadReplies],
  );

  if (!parentMessage) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.flex}
        >
          <Pressable style={s.sheet}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              <Text style={s.headerTitle}>Thread</Text>
              <TouchableOpacity
                style={s.closeBtn}
                onPress={onClose}
                accessibilityLabel="Close thread"
              >
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Parent message */}
            <View style={s.parentSection}>
              <MessageItem
                message={parentMessage}
                isOwn={parentMessage.core.sender.ids.id === currentProfileId}
                isGroupStart
                colors={colors}
                onReactionToggle={onReactionToggle}
                currentProfileId={currentProfileId}
                currentAccountId={currentAccountId}
              />
            </View>

            {/* Reply count */}
            {!loading && replies.length > 0 && (
              <Text style={s.repliesHeader}>
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            )}

            {/* Replies list */}
            {loading ? (
              <View style={s.center}>
                <ActivityIndicator size="small" color={colors.teal} />
              </View>
            ) : replies.length === 0 ? (
              <View style={s.center}>
                <Text style={s.emptyTxt}>No replies yet — start the thread!</Text>
              </View>
            ) : (
              <FlatList
                data={replies}
                keyExtractor={(item) => item.ids.id}
                renderItem={({ item }) => (
                  <MessageItem
                    message={item}
                    isOwn={item.core.sender.ids.id === currentProfileId}
                    isGroupStart
                    colors={colors}
                    onReactionToggle={onReactionToggle}
                    currentProfileId={currentProfileId}
                    currentAccountId={currentAccountId}
                  />
                )}
                contentContainerStyle={{ paddingVertical: 8 }}
              />
            )}

            {/* Reply input */}
            <MessageInput onSend={handleSend} placeholder="Reply in thread…" />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};
