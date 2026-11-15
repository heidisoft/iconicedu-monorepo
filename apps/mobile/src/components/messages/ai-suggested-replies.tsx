import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Sparkles, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { fetchSuggestedReplies } from '@/lib/api/messages/queries';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { AiBadge } from './ai-badge';

// ─── "Suggested replies" affordance (issue #264) ───────────────────────────
//
// Explicit-invoke only: a button near the composer, never automatic. Tapping
// a chip inserts its text into the composer as editable text — it never
// auto-sends.

type AiSuggestedRepliesProps = {
  orgId: string;
  channelId: string;
  profileId: string;
  disabled?: boolean;
  onSelect: (text: string) => void;
};

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: {
      backgroundColor: C.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    triggerLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: C.teal,
      flex: 1,
    },
    panel: {
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    loadingText: {
      fontSize: 13,
      color: C.textMuted,
    },
    emptyText: {
      fontSize: 13,
      color: C.textMuted,
      paddingVertical: 6,
    },
    errorText: {
      fontSize: 13,
      color: C.red,
      marginBottom: 8,
    },
    retryLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: C.teal,
    },
    chipsRow: {
      gap: 8,
      flexDirection: 'row',
    },
    chip: {
      maxWidth: 260,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    chipText: {
      fontSize: 14,
      color: C.text,
    },
  });
}

export const AiSuggestedReplies: React.FC<AiSuggestedRepliesProps> = ({
  orgId,
  channelId,
  profileId,
  disabled = false,
  onSelect,
}) => {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchSuggestedReplies({ orgId, channelId, profileId });
      setSuggestions(res.suggestions);
    } catch (error) {
      reportMobileObservedError({
        error,
        source: 'mobile.messages.ai_suggested_replies.fetch',
        message: 'AI suggested replies request failed',
      });
      setSuggestions(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load suggestions. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, channelId, profileId]);

  const handleToggle = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    void loadSuggestions();
  }, [expanded, loadSuggestions]);

  const handleSelect = useCallback(
    (suggestion: string) => {
      onSelect(suggestion);
      setExpanded(false);
    },
    [onSelect],
  );

  return (
    <View style={s.root}>
      <TouchableOpacity
        style={s.trigger}
        onPress={handleToggle}
        disabled={disabled}
        accessibilityLabel="Suggested replies"
        accessibilityState={{ disabled: disabled ?? false, expanded }}
      >
        <Sparkles size={14} color={colors.teal} />
        <Text style={s.triggerLabel}>Suggested replies</Text>
        {expanded ? (
          <ChevronUp size={16} color={colors.textMuted} />
        ) : (
          <ChevronDown size={16} color={colors.textMuted} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={s.panel}>
          {loading ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={colors.teal} />
              <Text style={s.loadingText}>Finding a few replies…</Text>
            </View>
          ) : errorMessage ? (
            <>
              <Text style={s.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                onPress={() => void loadSuggestions()}
                accessibilityLabel="Try again"
              >
                <Text style={s.retryLabel}>Try again</Text>
              </TouchableOpacity>
            </>
          ) : suggestions && suggestions.length > 0 ? (
            <>
              <AiBadge />
              <View style={{ height: 8 }} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chipsRow}
              >
                {suggestions.map((suggestion, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.chip}
                    onPress={() => handleSelect(suggestion)}
                    accessibilityLabel={`Use suggestion: ${suggestion}`}
                  >
                    <Text style={s.chipText} numberOfLines={3}>
                      {suggestion}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={s.emptyText}>No suggestions right now.</Text>
          )}
        </View>
      )}
    </View>
  );
};
