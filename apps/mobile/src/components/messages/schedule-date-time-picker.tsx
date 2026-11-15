import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { combineDateAndTime } from '@/lib/messages/schedule-send';

// ─── Cross-platform date + time picker (issue #264 P2 — scheduled send) ───
//
// @react-native-community/datetimepicker does not support a combined
// `mode="datetime"` picker on Android (iOS-only), so both platforms pick the
// date and then the time as two steps:
//  - Android renders no UI of its own — the native picker already IS a
//    dialog, so we drive it imperatively via `DateTimePickerAndroid.open`.
//  - iOS shows two inline spinners inside our own modal card, since iOS
//    pickers are typically embedded rather than shown as system dialogs.

export type ScheduleDateTimePickerProps = {
  visible: boolean;
  initialDate?: Date;
  minimumDate?: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  title?: string;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: 'rgba(15, 23, 42, 0.42)',
    },
    card: {
      gap: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      padding: 18,
    },
    title: { fontSize: 17, fontWeight: '700', color: C.text },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 8,
    },
    btn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
    },
    cancelBtn: { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border },
    confirmBtn: { backgroundColor: C.teal },
    cancelText: { color: C.text, fontWeight: '600', fontSize: 15 },
    confirmText: { color: C.tealFg, fontWeight: '700', fontSize: 15 },
  });
}

export const ScheduleDateTimePicker: React.FC<ScheduleDateTimePickerProps> = ({
  visible,
  initialDate,
  minimumDate,
  onCancel,
  onConfirm,
  title = 'Schedule send',
}) => {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [pickedDate, setPickedDate] = useState<Date>(initialDate ?? new Date());
  const [pickedTime, setPickedTime] = useState<Date>(initialDate ?? new Date());

  const openAndroidFlow = useCallback(
    (base: Date) => {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        minimumDate,
        onChange: (dateEvent: DateTimePickerEvent, date?: Date) => {
          if (dateEvent.type !== 'set' || !date) {
            onCancel();
            return;
          }
          DateTimePickerAndroid.open({
            value: base,
            mode: 'time',
            onChange: (timeEvent: DateTimePickerEvent, time?: Date) => {
              if (timeEvent.type !== 'set' || !time) {
                onCancel();
                return;
              }
              onConfirm(combineDateAndTime(date, time));
            },
          });
        },
      });
    },
    [minimumDate, onCancel, onConfirm],
  );

  useEffect(() => {
    if (!visible) return;
    const base = initialDate ?? new Date();
    setPickedDate(base);
    setPickedTime(base);
    if (Platform.OS === 'android') {
      openAndroidFlow(base);
    }
    // Only re-run when the sheet is (re-)opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (Platform.OS === 'android') {
    // Android UI is fully driven by the imperative dialogs above.
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <DateTimePicker
            value={pickedDate}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            onChange={(_event: DateTimePickerEvent, date?: Date) => {
              if (date) setPickedDate(date);
            }}
            testID="schedule-date-picker"
          />
          <DateTimePicker
            value={pickedTime}
            mode="time"
            display="spinner"
            onChange={(_event: DateTimePickerEvent, time?: Date) => {
              if (time) setPickedTime(time);
            }}
            testID="schedule-time-picker"
          />
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btn, s.cancelBtn]}
              onPress={onCancel}
              accessibilityLabel="Cancel scheduling"
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.confirmBtn]}
              onPress={() => onConfirm(combineDateAndTime(pickedDate, pickedTime))}
              accessibilityLabel="Confirm scheduled time"
            >
              <Text style={s.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
