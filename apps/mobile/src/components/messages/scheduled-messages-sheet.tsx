import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import {
  Clock,
  X,
  Pencil,
  Send,
  Ban,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import {
  cancelScheduledMessage,
  fetchScheduledMessages,
  sendScheduledMessageNow,
  updateScheduledMessage,
  type ScheduledMessage,
} from '@/lib/api/queries';
import { formatScheduledSendAt } from '@/lib/messages/schedule-send';
import { ScheduleDateTimePicker } from './schedule-date-time-picker';

// ─── Scheduled send (issue #264 P2) ────────────────────────────────────────

export type ScheduledMessagesSheetProps = {
  visible: boolean;
  orgId: string;
  senderProfileId: string;
  onClose: () => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.modalOverlay },
    sheet: {
      backgroundColor: C.pageBg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
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
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      gap: 8,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    when: { fontSize: 13, fontWeight: '600', color: C.teal },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    content: { fontSize: 15, color: C.text, lineHeight: 20 },
    errorText: { fontSize: 13, color: C.red },
    editInput: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      padding: 10,
      fontSize: 15,
      color: C.text,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    actionBtnDisabled: { opacity: 0.4 },
    actionText: { fontSize: 13, fontWeight: '600', color: C.text },
    destructiveText: { color: C.red },
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

function statusColors(status: ScheduledMessage['status'], colors: AppColors) {
  switch (status) {
    case 'pending':
      return { bg: colors.tealBg, fg: colors.teal };
    case 'sent':
      return { bg: colors.tealBg, fg: colors.success };
    case 'failed':
      return { bg: `${colors.red}22`, fg: colors.red };
    case 'canceled':
    default:
      return { bg: colors.inputBg, fg: colors.textMuted };
  }
}

export function ScheduledMessagesSheet({
  visible,
  orgId,
  senderProfileId,
  onClose,
}: ScheduledMessagesSheetProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [rows, setRows] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId || !senderProfileId) return;
    setLoading(true);
    try {
      const scheduled = await fetchScheduledMessages({ orgId, senderProfileId });
      setRows(scheduled);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, senderProfileId]);

  useEffect(() => {
    if (visible) {
      void load();
    } else {
      setEditingId(null);
      setReschedulingId(null);
    }
  }, [visible, load]);

  const handleSendNow = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const updated = await sendScheduledMessageNow({ orgId, id });
        setRows((prev) => prev.map((r) => (r.ids.id === id ? updated : r)));
      } catch (error) {
        Alert.alert(
          'Unable to send now',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [orgId],
  );

  const handleCancel = useCallback(
    (id: string) => {
      Alert.alert('Cancel scheduled message?', 'This message will not be sent.', [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel message',
          style: 'destructive',
          onPress: async () => {
            setBusyId(id);
            try {
              await cancelScheduledMessage({ orgId, id });
              setRows((prev) =>
                prev.map((r) => (r.ids.id === id ? { ...r, status: 'canceled' } : r)),
              );
            } catch (error) {
              Alert.alert(
                'Unable to cancel',
                error instanceof Error ? error.message : 'Please try again.',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ]);
    },
    [orgId],
  );

  const startEdit = useCallback((row: ScheduledMessage) => {
    setEditingId(row.ids.id);
    setEditText(row.content);
  }, []);

  const saveEdit = useCallback(
    async (id: string) => {
      const trimmed = editText.trim();
      if (!trimmed) return;
      setBusyId(id);
      try {
        const updated = await updateScheduledMessage({ orgId, id, content: trimmed });
        setRows((prev) => prev.map((r) => (r.ids.id === id ? updated : r)));
        setEditingId(null);
      } catch (error) {
        Alert.alert(
          'Unable to save changes',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [orgId, editText],
  );

  const saveReschedule = useCallback(
    async (id: string, date: Date) => {
      setReschedulingId(null);
      setBusyId(id);
      try {
        const updated = await updateScheduledMessage({
          orgId,
          id,
          sendAt: date.toISOString(),
        });
        setRows((prev) => prev.map((r) => (r.ids.id === id ? updated : r)));
      } catch (error) {
        Alert.alert(
          'Unable to reschedule',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [orgId],
  );

  const reschedulingRow = rows.find((r) => r.ids.id === reschedulingId) ?? null;

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
            <Text style={s.title}>Scheduled messages</Text>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={onClose}
              accessibilityLabel="Close scheduled messages"
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
              <CalendarClock size={28} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No scheduled messages</Text>
              <Text style={s.emptyDesc}>
                Messages you schedule to send later will show up here.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {rows.map((row) => {
                const isPending = row.status === 'pending';
                const isFailed = row.status === 'failed';
                const canManage = isPending || isFailed;
                const isBusy = busyId === row.ids.id;
                const isEditing = editingId === row.ids.id;
                const sc = statusColors(row.status, colors);
                return (
                  <View key={row.ids.id} style={s.row}>
                    <View style={s.metaRow}>
                      <Clock size={13} color={colors.textMuted} />
                      <Text style={s.when}>
                        {formatScheduledSendAt(row.sendAt, row.timezone)}
                      </Text>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.fg }]}>{row.status}</Text>
                      </View>
                    </View>

                    {isEditing ? (
                      <TextInput
                        style={s.editInput}
                        value={editText}
                        onChangeText={setEditText}
                        multiline
                        autoFocus
                        accessibilityLabel="Edit scheduled message"
                      />
                    ) : (
                      <Text style={s.content}>{row.content}</Text>
                    )}

                    {isFailed && !!row.lastError && (
                      <View style={s.metaRow}>
                        <AlertTriangle size={13} color={colors.red} />
                        <Text style={s.errorText}>{row.lastError}</Text>
                      </View>
                    )}

                    <View style={s.actionsRow}>
                      {isEditing ? (
                        <>
                          <TouchableOpacity
                            style={s.actionBtn}
                            disabled={isBusy}
                            onPress={() => {
                              void saveEdit(row.ids.id);
                            }}
                            accessibilityLabel="Save edited message"
                          >
                            <Text style={s.actionText}>
                              {isBusy ? 'Saving…' : 'Save'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.actionBtn}
                            onPress={() => setEditingId(null)}
                            accessibilityLabel="Cancel editing"
                          >
                            <Text style={s.actionText}>Cancel</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[s.actionBtn, !isPending && s.actionBtnDisabled]}
                            disabled={!isPending || isBusy}
                            onPress={() => startEdit(row)}
                            accessibilityLabel="Edit scheduled message"
                            accessibilityState={{ disabled: !isPending || isBusy }}
                          >
                            <Pencil size={13} color={colors.text} />
                            <Text style={s.actionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.actionBtn, !isPending && s.actionBtnDisabled]}
                            disabled={!isPending || isBusy}
                            onPress={() => setReschedulingId(row.ids.id)}
                            accessibilityLabel="Reschedule message"
                            accessibilityState={{ disabled: !isPending || isBusy }}
                          >
                            <CalendarClock size={13} color={colors.text} />
                            <Text style={s.actionText}>Reschedule</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.actionBtn, !isPending && s.actionBtnDisabled]}
                            disabled={!isPending || isBusy}
                            onPress={() => {
                              void handleSendNow(row.ids.id);
                            }}
                            accessibilityLabel="Send now"
                            accessibilityState={{ disabled: !isPending || isBusy }}
                          >
                            <Send size={13} color={colors.text} />
                            <Text style={s.actionText}>
                              {isBusy ? 'Sending…' : 'Send now'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.actionBtn, !canManage && s.actionBtnDisabled]}
                            disabled={!canManage || isBusy}
                            onPress={() => handleCancel(row.ids.id)}
                            accessibilityLabel="Cancel scheduled message"
                            accessibilityState={{ disabled: !canManage || isBusy }}
                          >
                            <Ban size={13} color={colors.red} />
                            <Text style={[s.actionText, s.destructiveText]}>Cancel</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>

      <ScheduleDateTimePicker
        visible={!!reschedulingRow}
        initialDate={reschedulingRow ? new Date(reschedulingRow.sendAt) : undefined}
        minimumDate={new Date()}
        title="Reschedule send"
        onCancel={() => setReschedulingId(null)}
        onConfirm={(date) => {
          if (reschedulingRow) {
            void saveReschedule(reschedulingRow.ids.id, date);
          }
        }}
      />
    </Modal>
  );
}
