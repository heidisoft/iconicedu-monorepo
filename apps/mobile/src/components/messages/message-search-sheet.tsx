import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Search, X, Filter } from 'lucide-react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { searchChannelMessages, type MessageSearchResult } from '@/lib/api/queries';
import { getInitials } from './message-item';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import {
  splitTextByMatchRanges,
  getSearchResultText,
} from '@/lib/messages/highlight-match-ranges';

// ─── Search within messages (issue #264 P2) ────────────────────────────────

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

function formatResultDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export type MessageSearchSheetProps = {
  visible: boolean;
  orgId: string;
  channelId: string;
  profileId: string;
  accountId: string;
  /** Optional sender filter options — pass the channel's member list when available. */
  senderOptions?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onResultPress: (messageId: string) => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: C.pageBg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.inputBg,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 40,
    },
    input: { flex: 1, fontSize: 16, color: C.text },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBtnActive: { backgroundColor: C.tealBg },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    chipActive: { backgroundColor: C.tealBg, borderColor: C.teal },
    chipText: { fontSize: 13, color: C.text, fontWeight: '600' },
    chipTextActive: { color: C.teal },
    resultRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { fontWeight: '700', fontSize: 12 },
    resultBody: { flex: 1, gap: 2 },
    resultMeta: { fontSize: 12, color: C.textMuted },
    resultSnippet: { fontSize: 15, color: C.text, lineHeight: 20 },
    matched: { fontWeight: '700', backgroundColor: C.tealBg, color: C.teal },
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

export function MessageSearchSheet({
  visible,
  orgId,
  channelId,
  profileId,
  accountId,
  senderOptions = [],
  onClose,
  onResultPress,
}: MessageSearchSheetProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [senderFilter, setSenderFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(
    async (text: string, sender: string | null) => {
      if (!orgId || !channelId || text.trim().length < MIN_QUERY_LENGTH) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        return;
      }
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const found = await searchChannelMessages({
          orgId,
          channelId,
          query: text.trim(),
          profileId,
          accountId,
          senderProfileId: sender ?? undefined,
        });
        if (requestIdRef.current === requestId) {
          setResults(found);
          setSearched(true);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [orgId, channelId, profileId, accountId],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query, senderFilter);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, senderFilter, runSearch]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSenderFilter(null);
      setResults([]);
      setSearched(false);
      setFiltersOpen(false);
    }
  }, [visible]);

  const renderResult = useCallback(
    ({ item }: { item: MessageSearchResult }) => {
      const sender: MessageVM['core']['sender'] = item.message.core.sender;
      const senderName = sender.profile.displayName;
      const avatarColors = profileAvatarColors({ seed: senderName });
      const text = getSearchResultText(item.message);
      const segments = splitTextByMatchRanges(text, item.matchRanges);
      return (
        <TouchableOpacity
          style={s.resultRow}
          activeOpacity={0.7}
          onPress={() => onResultPress(item.message.ids.id)}
        >
          <View style={[s.avatar, { backgroundColor: avatarColors.bg }]}>
            <Text style={[s.avatarTxt, { color: avatarColors.fg }]}>
              {getInitials(senderName)}
            </Text>
          </View>
          <View style={s.resultBody}>
            <Text style={s.resultMeta}>
              {senderName} · {formatResultDate(item.message.core.createdAt)}
            </Text>
            <Text style={s.resultSnippet} numberOfLines={3}>
              {segments.map((seg, i) => (
                <Text key={i} style={seg.matched ? s.matched : undefined}>
                  {seg.text}
                </Text>
              ))}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [s, onResultPress],
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={undefined}>
        <View style={s.header}>
          <View style={s.searchBox}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search messages"
              placeholderTextColor={colors.textFaint}
              autoFocus
              accessibilityLabel="Search messages input"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                accessibilityLabel="Clear search"
              >
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {senderOptions.length > 0 && (
            <TouchableOpacity
              style={[s.filterBtn, filtersOpen && s.filterBtnActive]}
              onPress={() => setFiltersOpen((v) => !v)}
              accessibilityLabel="Toggle search filters"
            >
              <Filter size={16} color={filtersOpen ? colors.teal : colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.closeBtn}
            onPress={onClose}
            accessibilityLabel="Close search"
          >
            <X size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {filtersOpen && senderOptions.length > 0 && (
          <View style={s.filterRow}>
            <TouchableOpacity
              style={[s.chip, senderFilter === null && s.chipActive]}
              onPress={() => setSenderFilter(null)}
            >
              <Text style={[s.chipText, senderFilter === null && s.chipTextActive]}>
                Anyone
              </Text>
            </TouchableOpacity>
            {senderOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[s.chip, senderFilter === opt.id && s.chipActive]}
                onPress={() => setSenderFilter(opt.id)}
              >
                <Text style={[s.chipText, senderFilter === opt.id && s.chipTextActive]}>
                  {opt.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <View style={s.emptyState}>
            <ActivityIndicator size="large" color={colors.teal} />
          </View>
        ) : query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH ? (
          <View style={s.emptyState}>
            <Text style={s.emptyDesc}>Keep typing to search…</Text>
          </View>
        ) : searched && results.length === 0 ? (
          <View style={s.emptyState}>
            <Search size={28} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No results</Text>
            <Text style={s.emptyDesc}>
              No messages match &quot;{query.trim()}&quot; in this channel.
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.message.ids.id}
            renderItem={renderResult}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </Pressable>
    </Modal>
  );
}
