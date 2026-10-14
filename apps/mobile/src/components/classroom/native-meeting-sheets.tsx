import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send, X } from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { NativeChatMessage } from '@/lib/classroom/meeting-controller';
import { useTheme } from '@/providers/theme-provider';

/** Same wording as web's formatRelativeTime so both chats read alike. */
export function formatRelativeTime(timestamp: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return 'Now';
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  return `${Math.floor(elapsedHours / 24)} d ago`;
}

/** Web opens chat and people as side sheets over the call rather than inline. */
export function NativeMeetingSheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 20,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{ color: colors.text, fontSize: 26, fontWeight: '500' }}
              >
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close ${title}`}
                onPress={onClose}
                style={{ padding: 8 }}
              >
                <X size={22} color={colors.text} />
              </Pressable>
            </View>
            {children}
            {footer}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

export function NativeChatSheet({
  open,
  messages,
  canSend,
  blockedReason,
  onSend,
  onClose,
}: {
  open: boolean;
  messages: NativeChatMessage[];
  canSend: boolean;
  blockedReason?: string;
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);
  // Re-render each minute so relative times stay current while the sheet is open.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [open]);
  // A new message must not be measured against the clock from when the sheet opened.
  useEffect(() => {
    if (open) setNow(Date.now());
  }, [open, messages]);
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    void onSend(text).then(() => setDraft(''));
  };
  return (
    <NativeMeetingSheet
      open={open}
      title="In-call Messages"
      onClose={onClose}
      footer={
        canSend ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              margin: 20,
              padding: 6,
              borderRadius: 999,
              backgroundColor: colors.inputBg,
            }}
          >
            <TextInput
              accessibilityLabel="Message"
              placeholder="Send a message"
              placeholderTextColor={colors.textMuted}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              returnKeyType="send"
              maxLength={2000}
              style={{
                flex: 1,
                color: colors.text,
                paddingHorizontal: 12,
                minHeight: 40,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !draft.trim() }}
              disabled={!draft.trim()}
              onPress={send}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.action,
                opacity: draft.trim() ? 1 : 0.5,
              }}
            >
              <Send size={18} color={colors.actionForeground} />
            </Pressable>
          </View>
        ) : blockedReason ? (
          <Text style={{ color: colors.textMuted, margin: 20 }}>{blockedReason}</Text>
        ) : null
      }
    >
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No messages yet.</Text>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {message.self ? 'You' : message.sender}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {formatRelativeTime(message.sentAt, now)}
                </Text>
              </View>
              <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
                {message.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </NativeMeetingSheet>
  );
}
