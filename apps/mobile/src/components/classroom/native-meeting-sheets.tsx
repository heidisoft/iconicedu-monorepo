import { useReducedMotion } from './use-reduced-motion';
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
  useWindowDimensions,
} from 'react-native';
import { Send, X } from 'lucide-react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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
  onDismiss,
  compact = false,
  sidePanel = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onDismiss?: () => void;
  compact?: boolean;
  sidePanel?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const widePanel = sidePanel && width >= 700;
  const reducedMotion = useReducedMotion();
  const content = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  // pageSheet uses an inset origin; keyboard events use screen coordinates.
  const measureContent = () =>
    content.current?.measureInWindow((_x, y) => setKeyboardOffset(y));
  return (
    <Modal
      visible={open}
      animationType={reducedMotion ? 'none' : 'slide'}
      transparent={compact || widePanel}
      presentationStyle={compact || widePanel ? 'overFullScreen' : 'pageSheet'}
      onRequestClose={onClose}
      onDismiss={onDismiss}
      onShow={measureContent}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: compact ? 'flex-end' : undefined,
            backgroundColor: compact || widePanel ? 'rgba(0,0,0,0.15)' : colors.bg,
          }}
        >
          {(compact || widePanel) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${title}`}
              onPress={onClose}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            />
          )}
          <View
            ref={content}
            onLayout={measureContent}
            pointerEvents="box-none"
            style={{ flex: 1, justifyContent: compact ? 'flex-end' : undefined }}
          >
            <KeyboardAvoidingView
              style={
                compact
                  ? {
                      maxHeight: '75%',
                      width: '100%',
                      maxWidth: width >= 700 ? 320 : 560,
                      alignSelf: 'center',
                      backgroundColor: colors.card,
                      borderTopLeftRadius: 24,
                      borderTopRightRadius: 24,
                      overflow: 'hidden',
                    }
                  : widePanel
                    ? {
                        flex: 1,
                        width: '100%',
                        maxWidth: 512,
                        alignSelf: 'flex-end',
                        margin: 16,
                        borderRadius: 32,
                        backgroundColor: colors.bg,
                        overflow: 'hidden',
                      }
                    : { flex: 1 }
              }
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={
                Platform.OS === 'ios' ? Math.max(keyboardOffset, insets.top) : 0
              }
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: sidePanel ? 28 : 20,
                  paddingVertical: sidePanel ? 24 : 12,
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={{
                    color: colors.text,
                    fontSize: sidePanel ? 30 : 18,
                    fontWeight: sidePanel ? '500' : '600',
                    flex: 1,
                    flexShrink: 1,
                    marginRight: 8,
                  }}
                >
                  {title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${title}`}
                  onPress={onClose}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 22,
                    backgroundColor: colors.actionSubtle,
                  }}
                >
                  <X size={22} color={colors.text} />
                </Pressable>
              </View>
              {children}
              {footer}
            </KeyboardAvoidingView>
          </View>
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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const atLatest = useRef(true);
  useEffect(() => {
    if (open) atLatest.current = true;
  }, [open]);
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
    if (!text || !canSend || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    void onSend(text)
      .then(() => setDraft((current) => (current.trim() === text ? '' : current)))
      .catch(() => setSendError('Message could not be sent. Try again.'))
      .finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
  };
  return (
    <NativeMeetingSheet
      open={open}
      title="In-call Messages"
      sidePanel
      onClose={onClose}
      footer={
        canSend ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              margin: 28,
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
              accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }}
              disabled={sending || !draft.trim()}
              onPress={send}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                opacity: draft.trim() && !sending ? 1 : 0.5,
              }}
            >
              <Send size={18} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, margin: 28 }}>
            {blockedReason ?? 'Sending messages is disabled for this meeting.'}
          </Text>
        )
      }
    >
      {sendError && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: colors.red, marginHorizontal: 20, marginBottom: 8 }}
        >
          {sendError}
        </Text>
      )}
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => {
          if (atLatest.current) scroll.current?.scrollToEnd({ animated: false });
        }}
        scrollEventThrottle={16}
        onScroll={({
          nativeEvent: { contentOffset, layoutMeasurement, contentSize },
        }) => {
          atLatest.current =
            contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
        }}
        contentContainerStyle={{ paddingHorizontal: 28, paddingVertical: 12, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No messages yet.</Text>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
                  {message.self ? 'You' : message.sender}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {formatRelativeTime(message.sentAt, now)}
                </Text>
              </View>
              <Text
                selectable
                style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}
              >
                {message.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </NativeMeetingSheet>
  );
}
