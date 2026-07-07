import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import type { SelfServeRescheduleOptionsVM } from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';

type Props = {
  colors: AppColors;
  options?: SelfServeRescheduleOptionsVM | null;
  isLoading?: boolean;
  selectedDate: string;
  selectedStartAt?: string | null;
  onSelectDay: (date: string) => void;
  onSelectSlot: (slot: { startAt: string; endAt: string }) => void;
};

export function RescheduleAvailabilityPicker({
  colors,
  options,
  isLoading = false,
  selectedDate,
  selectedStartAt,
  onSelectDay,
  onSelectSlot,
}: Props) {
  const [open, setOpen] = useState(false);
  const days = options?.days ?? [];
  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? days[0] ?? null,
    [days, selectedDate],
  );

  if (isLoading) {
    return (
      <View style={[styles.loading, { borderColor: colors.border }]}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (!selectedDay) {
    return (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No teacher availability is set.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[
          styles.dropdownButton,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        onPress={() => setOpen((current) => !current)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Choose reschedule date"
      >
        <Text style={[styles.dropdownText, { color: colors.text }]}>
          {selectedDay.label}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {open ? (
        <View
          style={[
            styles.dropdownPanel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {days.map((day) => (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.dayOption,
                day.date === selectedDay.date ? { backgroundColor: colors.tealBg } : null,
              ]}
              onPress={() => {
                setOpen(false);
                onSelectDay(day.date);
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.dayOptionText,
                  { color: day.date === selectedDay.date ? colors.teal : colors.text },
                ]}
              >
                {day.label}
              </Text>
              <Text style={[styles.dayOptionCount, { color: colors.textMuted }]}>
                {day.slots.length}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slotRow}
      >
        {selectedDay.slots.length ? (
          selectedDay.slots.map((slot) => {
            const selected = slot.startAt === selectedStartAt;
            return (
              <TouchableOpacity
                key={slot.startAt}
                style={[
                  styles.slotPill,
                  {
                    backgroundColor: selected ? colors.tealBg : colors.inputBg,
                    borderColor: selected ? colors.teal : colors.border,
                  },
                ]}
                onPress={() => onSelectSlot(slot)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.slotText,
                    { color: selected ? colors.teal : colors.text },
                  ]}
                >
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No availability on this day.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  loading: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownPanel: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dayOption: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayOptionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  dayOptionCount: {
    fontSize: 12,
    fontWeight: '800',
  },
  slotRow: {
    minHeight: 40,
    gap: 8,
    alignItems: 'center',
  },
  slotPill: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
