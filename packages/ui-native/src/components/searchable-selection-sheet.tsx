import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Search, X } from 'lucide-react-native';

export type SelectionOption = {
  id: string;
  label: string;
  detail?: string;
  subtitle?: string;
  searchText?: string;
};
type Colors = {
  card: string;
  text: string;
  textMuted: string;
  border: string;
  inputBg: string;
  action: string;
  actionSubtle: string;
};

type Props = {
  visible: boolean;
  bottomInset?: number;
  options: readonly SelectionOption[];
  title: string;
  searchPlaceholder: string;
  closeLabel: string;
  emptyMessage: string;
  selectedId: string;
  preserveOrder?: boolean;
  colors: Colors;
  onSelect: (option: SelectionOption) => void;
  onClose: () => void;
};

export function SearchableSelectionSheet({
  visible,
  bottomInset = 0,
  options,
  selectedId,
  preserveOrder = false,
  title,
  searchPlaceholder,
  closeLabel,
  emptyMessage,
  colors,
  onSelect,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = [...options].filter((option) =>
      [option.label, option.detail, option.subtitle, option.searchText].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
    return preserveOrder
      ? matches
      : matches.sort(
          (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
        );
  }, [options, search, preserveOrder]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={() => setSearch('')}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.card, paddingBottom: bottomInset },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.text }]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              style={styles.close}
            >
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <View
            style={[
              styles.search,
              { backgroundColor: colors.inputBg, borderColor: colors.border },
            ]}
          >
            <Search size={20} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: colors.text }]}
              accessibilityLabel={searchPlaceholder}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.empty, { color: colors.textMuted }]}
              >
                {emptyMessage}
              </Text>
            }
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <Pressable
                  testID={`selection-option-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={[item.label, item.subtitle, item.detail]
                    .filter(Boolean)
                    .join(', ')}
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(item)}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: selected ? colors.actionSubtle : colors.card,
                    },
                  ]}
                >
                  <View style={styles.country}>
                    <Text style={[styles.countryLabel, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    {!!item.subtitle && (
                      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                  {!!item.detail && (
                    <Text style={[styles.code, { color: colors.textMuted }]}>
                      {item.detail}
                    </Text>
                  )}
                  <View style={styles.check}>
                    {selected && <Check size={20} color={colors.action} />}
                  </View>
                </Pressable>
              );
            }}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
    gap: 12,
  },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, minHeight: 48, fontSize: 16, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  country: { flex: 1, gap: 4 },
  countryLabel: { fontSize: 17 },
  subtitle: { fontSize: 14 },
  code: { fontSize: 16 },
  check: { width: 20 },
  empty: { padding: 24, fontSize: 16, textAlign: 'center' },
});
