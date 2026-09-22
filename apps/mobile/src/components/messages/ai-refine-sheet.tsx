import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, AlertTriangle } from 'lucide-react-native';
import { BottomSheet } from '@iconicedu/ui-native';
import type { AiRefineDraftResult, AiRefineInstruction } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import { refineDraftWithAi } from '@/lib/api/messages/queries';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { AiBadge } from './ai-badge';

// ─── "Refine with AI" instruction sheet + preview (issue #264) ────────────
//
// Tap-to-invoke only: never automatic, never on a timer, never as-you-type.
// Operates on the whole composer draft rather than a text selection — see
// the README note in this file's companion PR for the tradeoff.

const MAX_CUSTOM_INSTRUCTION_LENGTH = 500;
const MAX_TARGET_LANGUAGE_LENGTH = 60;

type Stage =
  | 'picker'
  | 'translate-input'
  | 'custom-input'
  | 'loading'
  | 'preview'
  | 'error';

type InstructionOption = {
  key: AiRefineInstruction;
  label: string;
  sub: string;
};

const INSTRUCTION_OPTIONS: InstructionOption[] = [
  { key: 'proofread', label: 'Proofread', sub: 'Fix spelling & grammar' },
  { key: 'clearer', label: 'Make clearer', sub: 'Simplify the wording' },
  { key: 'shorter', label: 'Make shorter', sub: 'Trim it down' },
  { key: 'warmer', label: 'Warmer tone', sub: 'Sound more friendly' },
  { key: 'professional', label: 'More professional', sub: 'Sound more formal' },
  { key: 'translate', label: 'Translate', sub: 'Translate to another language' },
  { key: 'custom', label: 'Custom', sub: 'Give your own instructions' },
];

type AiRefineSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The full composer draft to refine. */
  draftText: string;
  orgId: string;
  channelId: string;
  profileId: string;
  /** Called when the user taps "Replace" in the preview. */
  onReplace: (refinedText: string) => void;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, bottomInset: number) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingBottom: Math.max(bottomInset, 20),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 10,
      paddingVertical: 4,
    },
    backLabel: {
      fontSize: 14,
      color: C.textMuted,
    },

    // ── Picker menu ──
    menuItem: {
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: C.text,
    },
    menuSub: {
      fontSize: 13,
      color: C.textMuted,
      marginTop: 2,
    },

    // ── Free-text input stages ──
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      borderRadius: 12,
      backgroundColor: C.inputBg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: C.text,
      minHeight: 44,
    },
    multilineInput: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    counter: {
      fontSize: 12,
      color: C.textMuted,
      textAlign: 'right',
      marginTop: 4,
    },

    // ── Loading ──
    loadingWrap: {
      alignItems: 'center',
      paddingVertical: 36,
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: C.textMuted,
    },

    // ── Preview ──
    previewScroll: {
      maxHeight: 220,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      borderRadius: 12,
      backgroundColor: C.card,
      padding: 14,
      marginBottom: 12,
    },
    previewText: {
      fontSize: 15,
      lineHeight: 21,
      color: C.text,
    },
    warningBox: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.warningSubtle,
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
    },
    warningTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: C.warning,
      marginBottom: 2,
    },
    warningNote: {
      fontSize: 13,
      color: C.warning,
      lineHeight: 18,
    },

    // ── Error ──
    errorText: {
      fontSize: 14,
      color: C.red,
      marginBottom: 18,
      lineHeight: 20,
    },

    // ── Buttons ──
    primaryBtn: {
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.teal,
      alignItems: 'center',
    },
    primaryBtnLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: C.tealFg,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      alignItems: 'center',
    },
    secondaryBtnLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textMuted,
    },
    replaceBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: C.teal,
      alignItems: 'center',
    },
    replaceBtnLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: C.tealFg,
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AiRefineSheet: React.FC<AiRefineSheetProps> = ({
  visible,
  onClose,
  draftText,
  orgId,
  channelId,
  profileId,
  onReplace,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom]);

  const [stage, setStage] = useState<Stage>('picker');
  const [instruction, setInstruction] = useState<AiRefineInstruction | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [result, setResult] = useState<AiRefineDraftResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset all state whenever the sheet closes so the next open starts fresh.
  useEffect(() => {
    if (!visible) {
      setStage('picker');
      setInstruction(null);
      setTargetLanguage('');
      setCustomInstruction('');
      setResult(null);
      setErrorMessage(null);
    }
  }, [visible]);

  const runRefine = useCallback(
    async (instructionToUse: AiRefineInstruction) => {
      setStage('loading');
      setErrorMessage(null);
      try {
        const res = await refineDraftWithAi({
          orgId,
          channelId,
          profileId,
          content: draftText,
          instruction: instructionToUse,
          customInstruction:
            instructionToUse === 'custom' ? customInstruction.trim() : undefined,
          targetLanguage:
            instructionToUse === 'translate' ? targetLanguage.trim() : undefined,
        });
        setResult(res);
        setStage('preview');
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.ai_refine_sheet.refine',
          message: 'AI refine draft request failed',
          context: { instruction: instructionToUse },
        });
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Something went wrong refining your draft. Please try again.',
        );
        setStage('error');
      }
    },
    [orgId, channelId, profileId, draftText, customInstruction, targetLanguage],
  );

  const handlePickInstruction = useCallback(
    (key: AiRefineInstruction) => {
      setInstruction(key);
      if (key === 'translate') {
        setStage('translate-input');
        return;
      }
      if (key === 'custom') {
        setStage('custom-input');
        return;
      }
      void runRefine(key);
    },
    [runRefine],
  );

  const handleSubmitTranslate = useCallback(() => {
    if (!targetLanguage.trim()) return;
    void runRefine('translate');
  }, [targetLanguage, runRefine]);

  const handleSubmitCustom = useCallback(() => {
    if (!customInstruction.trim()) return;
    void runRefine('custom');
  }, [customInstruction, runRefine]);

  const handleTryAgain = useCallback(() => {
    if (!instruction) {
      setStage('picker');
      return;
    }
    void runRefine(instruction);
  }, [instruction, runRefine]);

  const handleReplace = useCallback(() => {
    if (!result) return;
    onReplace(result.refinedText);
  }, [result, onReplace]);

  const handleBackToPicker = useCallback(() => {
    setStage('picker');
  }, []);

  const showFactsWarning =
    result?.factsPreserved === false && !!result.flaggedNotes?.length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      allowExpand
      backdropColor={colors.modalOverlay}
      sheetStyle={{ backgroundColor: colors.pageBg }}
      dragHandleStyle={{ backgroundColor: colors.border }}
      testID="ai-refine-sheet"
    >
      <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
        {stage === 'picker' && (
          <>
            <View style={s.header}>
              <AiBadge />
              <Text style={s.title}>Refine with AI</Text>
            </View>
            {INSTRUCTION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={s.menuItem}
                onPress={() => handlePickInstruction(opt.key)}
                accessibilityLabel={opt.label}
                accessibilityRole="button"
              >
                <Text style={s.menuLabel}>{opt.label}</Text>
                <Text style={s.menuSub}>{opt.sub}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {stage === 'translate-input' && (
          <>
            <TouchableOpacity
              style={s.backRow}
              onPress={handleBackToPicker}
              accessibilityLabel="Back to instructions"
            >
              <ChevronLeft size={18} color={colors.textMuted} />
              <Text style={s.backLabel}>Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>Translate to…</Text>
            <View style={{ height: 12 }} />
            <TextInput
              style={s.input}
              value={targetLanguage}
              onChangeText={setTargetLanguage}
              placeholder="e.g. Spanish"
              placeholderTextColor={colors.textFaint}
              maxLength={MAX_TARGET_LANGUAGE_LENGTH}
              accessibilityLabel="Target language"
              autoFocus
            />
            <View style={{ height: 16 }} />
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleSubmitTranslate}
              disabled={!targetLanguage.trim()}
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !targetLanguage.trim() }}
            >
              <Text style={s.primaryBtnLabel}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'custom-input' && (
          <>
            <TouchableOpacity
              style={s.backRow}
              onPress={handleBackToPicker}
              accessibilityLabel="Back to instructions"
            >
              <ChevronLeft size={18} color={colors.textMuted} />
              <Text style={s.backLabel}>Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>Custom instructions</Text>
            <View style={{ height: 12 }} />
            <TextInput
              style={[s.input, s.multilineInput]}
              value={customInstruction}
              onChangeText={(t) =>
                setCustomInstruction(t.slice(0, MAX_CUSTOM_INSTRUCTION_LENGTH))
              }
              placeholder="e.g. Make it sound more upbeat and add an emoji"
              placeholderTextColor={colors.textFaint}
              maxLength={MAX_CUSTOM_INSTRUCTION_LENGTH}
              multiline
              accessibilityLabel="Custom instructions"
              autoFocus
            />
            <Text style={s.counter}>
              {customInstruction.length}/{MAX_CUSTOM_INSTRUCTION_LENGTH}
            </Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleSubmitCustom}
              disabled={!customInstruction.trim()}
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !customInstruction.trim() }}
            >
              <Text style={s.primaryBtnLabel}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'loading' && (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="small" color={colors.teal} />
            <Text style={s.loadingText}>Refining your draft…</Text>
          </View>
        )}

        {stage === 'preview' && result && (
          <>
            <View style={s.header}>
              <AiBadge label="AI suggestion" />
            </View>
            <ScrollView style={s.previewScroll}>
              <Text style={s.previewText} selectable>
                {result.refinedText}
              </Text>
            </ScrollView>
            {showFactsWarning && (
              <View style={s.warningBox}>
                <AlertTriangle size={16} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={s.warningTitle}>Double-check before sending</Text>
                  {result.flaggedNotes!.map((note, i) => (
                    <Text key={i} style={s.warningNote}>
                      • {note}
                    </Text>
                  ))}
                </View>
              </View>
            )}
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={onClose}
                accessibilityLabel="Keep original"
              >
                <Text style={s.secondaryBtnLabel}>Keep original</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={handleTryAgain}
                accessibilityLabel="Try again"
              >
                <Text style={s.secondaryBtnLabel}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.replaceBtn}
                onPress={handleReplace}
                accessibilityLabel="Replace"
              >
                <Text style={s.replaceBtnLabel}>Replace</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {stage === 'error' && (
          <>
            <View style={s.header}>
              <AiBadge />
              <Text style={s.title}>Refine with AI</Text>
            </View>
            <Text style={s.errorText}>{errorMessage}</Text>
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={onClose}
                accessibilityLabel="Keep original"
              >
                <Text style={s.secondaryBtnLabel}>Keep original</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.replaceBtn}
                onPress={handleTryAgain}
                accessibilityLabel="Try again"
              >
                <Text style={s.replaceBtnLabel}>Try again</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
