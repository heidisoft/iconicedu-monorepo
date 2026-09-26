import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MessageReplyReferenceVM } from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';

/**
 * Compact "quoted" block rendered on a message that was sent as a reply to
 * another message (MessageVM.social.replyTo). Shared between the classic
 * (message-item.tsx) and feed (feed-message-list.tsx) list themes so both
 * render replies identically.
 *
 * Tapping it asks the caller (onPress) to scroll to / highlight the original
 * message. When the original is no longer loaded (or was deleted), onPress
 * is still safe to call — callers are expected to no-op gracefully — and
 * replyTo.isUnavailable additionally disables the tap affordance entirely.
 */
export function ReplyReferenceBlock({
  replyTo,
  colors,
  onPress,
}: {
  replyTo: MessageReplyReferenceVM;
  colors: AppColors;
  onPress?: (messageId: string) => void;
}) {
  const isTappable = !replyTo.isUnavailable && !!onPress;

  return (
    <TouchableOpacity
      testID="reply-reference-block"
      disabled={!isTappable}
      activeOpacity={isTappable ? 0.7 : 1}
      onPress={() => onPress?.(replyTo.messageId)}
      accessibilityRole={isTappable ? 'button' : undefined}
      accessibilityLabel={
        replyTo.isUnavailable
          ? 'Original message unavailable'
          : `Replying to ${replyTo.senderName}`
      }
      style={[
        styles.block,
        { borderLeftColor: colors.teal, backgroundColor: colors.inputBg },
      ]}
    >
      {replyTo.isUnavailable ? (
        <Text style={[styles.unavailable, { color: colors.textFaint }]} numberOfLines={1}>
          Original message unavailable
        </Text>
      ) : (
        <View style={{ minWidth: 0 }}>
          <Text style={[styles.sender, { color: colors.teal }]} numberOfLines={1}>
            {replyTo.senderName}
          </Text>
          <Text style={[styles.snippet, { color: colors.textMuted }]} numberOfLines={1}>
            {replyTo.snippet || 'Message'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  block: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    maxWidth: '85%',
  },
  sender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
  },
  snippet: {
    fontSize: 12,
  },
  unavailable: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
