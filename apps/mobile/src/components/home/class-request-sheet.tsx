import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { BookOpen, ChevronDown, X } from 'lucide-react-native';
import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import { SearchableSelectionSheet } from '@iconicedu/ui-native/components/searchable-selection-sheet';
import { OTHER_SUBJECT_OPTION, STANDARD_SUBJECT_OPTIONS } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import { submitClassRequest } from '@/lib/api/queries';
import { ProfileTextInput } from '@/components/profile/profile-text-input';

export type RequestableStudent = { profileId: string; displayName: string };
const SUBJECTS = [...STANDARD_SUBJECT_OPTIONS, OTHER_SUBJECT_OPTION];

export function ClassRequestSheet({
  visible,
  onClose,
  students,
  defaultStudentIds,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  students: RequestableStudent[];
  defaultStudentIds: string[];
  onCreated: (channelId: string) => void;
}) {
  const { colors } = useTheme();
  const [studentIds, setStudentIds] = useState(defaultStudentIds);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [otherSubject, setOtherSubject] = useState('');
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<'students' | 'subjects' | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const submitting = useRef(false);
  const active = useRef(visible);
  active.current = visible;
  useEffect(() => {
    if (!visible) return;
    if (!submitting.current) setBusy(false);
    setStudentIds(defaultStudentIds);
    setSubjects([]);
    setOtherSubject('');
    setGoals('');
    setNotes('');
    setError(null);
    setPicker(null);
  }, [visible, defaultStudentIds]);
  useEffect(
    () => () => {
      active.current = false;
    },
    [],
  );

  function close() {
    if (!submitting.current) {
      active.current = false;
      onClose();
    }
  }
  async function submit() {
    if (submitting.current) return;
    const allowedIds = new Set(students.map((s) => s.profileId));
    if (!studentIds.length || studentIds.some((id) => !allowedIds.has(id))) {
      setError('Select at least one student.');
      return;
    }
    if (!subjects.length) {
      setError('Select at least one subject.');
      return;
    }
    if (subjects.includes(OTHER_SUBJECT_OPTION) && !otherSubject.trim()) {
      setError('Enter the custom subject when "Other" is selected.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await submitClassRequest({
        requestIntent: 'ongoing-tutoring',
        studentProfileIds: studentIds,
        subjects,
        otherSubject: subjects.includes(OTHER_SUBJECT_OPTION)
          ? otherSubject.trim()
          : null,
        learningGoals: goals.trim(),
        specialRequirements: notes.trim() || null,
      });
      if (active.current) {
        onClose();
        onCreated(response.channelId);
      }
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error && failure.message
            ? failure.message
            : 'Unable to create class request.',
        );
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  function choose(which: 'students' | 'subjects') {
    if (busy) return;
    Keyboard.dismiss();
    setSelection(which === 'students' ? studentIds : subjects);
    setPicker(which);
  }
  const labelStyle = { color: colors.text, fontSize: 17, fontWeight: '600' as const };
  const helperStyle = { color: colors.textMuted, fontSize: 15, lineHeight: 23 };
  function select(label: string, selected: string, which: 'students' | 'subjects') {
    return (
      <View style={{ gap: 10 }}>
        <Text style={labelStyle}>{label} *</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${which}`}
          accessibilityState={{ disabled: busy, expanded: picker === which }}
          accessibilityValue={{ text: selected || `Choose ${which}` }}
          disabled={busy}
          onPress={() => choose(which)}
          style={{
            minHeight: 60,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text
            style={{
              color: selected ? colors.text : colors.textMuted,
              flex: 1,
              fontSize: 17,
              lineHeight: 25,
            }}
          >
            {selected || `Choose ${which}`}
          </Text>
          <ChevronDown size={20} color={colors.textMuted} />
        </Pressable>
        <Text style={helperStyle}>
          {which === 'students'
            ? 'You can select more than one child.'
            : 'Choose all that apply, or select Other.'}
        </Text>
      </View>
    );
  }
  if (!visible) return null;
  return (
    <Modal
      visible
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={() => {
        if (picker) setPicker(null);
        else close();
      }}
    >
      <SheetContent backgroundColor={colors.pageBg}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingBottom: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close class request"
              disabled={busy}
              onPress={close}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.inputBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color={colors.text} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 17,
                fontWeight: '600',
                color: colors.text,
              }}
            >
              Explore Classes
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 32 }}
          >
            <View
              style={{
                backgroundColor: colors.promotionMint,
                borderRadius: 28,
                padding: 24,
                gap: 12,
              }}
            >
              <BookOpen size={32} color={colors.promotionMintForeground} />
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.promotionMintForeground,
                  fontSize: 30,
                  lineHeight: 36,
                  fontWeight: '800',
                }}
              >
                Let’s find their next class.
              </Text>
              <Text
                style={{
                  color: colors.promotionMintForeground,
                  fontSize: 17,
                  lineHeight: 25,
                }}
              >
                Tell us who is learning and what they need. Our team will help you explore
                suitable classes.
              </Text>
            </View>
            {select(
              'Students',
              students
                .filter((s) => studentIds.includes(s.profileId))
                .map((s) => s.displayName)
                .join(', '),
              'students',
            )}
            {select('Subjects', subjects.join(', '), 'subjects')}
            {subjects.includes(OTHER_SUBJECT_OPTION) && (
              <View style={{ gap: 10 }}>
                <Text style={labelStyle}>Other subject *</Text>
                <ProfileTextInput
                  accessibilityLabel="Other subject"
                  value={otherSubject}
                  onChangeText={setOtherSubject}
                  editable={!busy}
                  placeholder="Enter a subject"
                  autoCapitalize="sentences"
                />
              </View>
            )}
            <View style={{ gap: 10 }}>
              <Text style={labelStyle}>
                Learning goals <Text style={helperStyle}>(optional)</Text>
              </Text>
              <Text style={helperStyle}>
                Which topics or skills would you like the tutor to focus on?
              </Text>
              <ProfileTextInput
                accessibilityLabel="Learning goals"
                value={goals}
                onChangeText={setGoals}
                editable={!busy}
                multiline
                placeholder="Describe the support you want"
                style={{ fontSize: 17, lineHeight: 25 }}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Text style={labelStyle}>
                Special requirements <Text style={helperStyle}>(optional)</Text>
              </Text>
              <Text style={helperStyle}>
                Share any accommodations, learning preferences or notes for the tutor.
              </Text>
              <ProfileTextInput
                accessibilityLabel="Special requirements"
                value={notes}
                onChangeText={setNotes}
                editable={!busy}
                multiline
                placeholder="Anything else we should know?"
                style={{ fontSize: 17, lineHeight: 25 }}
              />
            </View>
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{ color: colors.red, fontSize: 16, lineHeight: 24 }}
              >
                {error}
              </Text>
            ) : null}
            <Text style={helperStyle}>
              Your request opens a conversation with our team. It does not book a class or
              take a payment.
            </Text>
          </ScrollView>
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Submit request"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => void submit()}
              style={{
                minHeight: 54,
                borderRadius: 18,
                padding: 16,
                backgroundColor: colors.action,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator
                  accessibilityLabel="Submitting class request"
                  color={colors.actionForeground}
                />
              ) : (
                <Text
                  style={{
                    color: colors.actionForeground,
                    fontSize: 17,
                    fontWeight: '600',
                  }}
                >
                  Submit request
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
        {picker && (
          <SearchableSelectionSheet
            visible
            title={picker === 'students' ? 'Select students' : 'Select subjects'}
            options={
              picker === 'students'
                ? students.map((s) => ({ id: s.profileId, label: s.displayName }))
                : SUBJECTS.map((id) => ({ id, label: id }))
            }
            selectedIds={selection}
            preserveOrder
            colors={colors}
            searchPlaceholder={
              picker === 'students' ? 'Search students' : 'Search subjects'
            }
            closeLabel="Cancel selection"
            emptyMessage="No matching options"
            onSelect={(option) =>
              setSelection((current) =>
                current.includes(option.id)
                  ? current.filter((id) => id !== option.id)
                  : [...current, option.id],
              )
            }
            onClose={() => setPicker(null)}
            onDone={() => {
              if (picker === 'students') setStudentIds(selection);
              else setSubjects(selection);
              setError(null);
              setPicker(null);
            }}
          />
        )}
      </SheetContent>
    </Modal>
  );
}
