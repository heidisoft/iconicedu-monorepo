import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextInputProps,
} from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import { useTheme } from '@/providers/theme-provider';
import { ProfileTextInput, profileFieldStyles } from './profile-text-input';

/** A field editor only updates the section draft; its Save action owns persistence. */
export function ProfileFieldEditor({
  label,
  value,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label}`}
        accessibilityValue={{ text: value || 'Not set' }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          ...profileFieldStyles(colors).selector,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={profileFieldStyles(colors).label}>{label}</Text>
          <Text style={{ color: value ? colors.text : colors.textMuted, fontSize: 17 }}>
            {value || 'Not set'}
          </Text>
        </View>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <Modal
          visible
          presentationStyle="pageSheet"
          animationType="slide"
          onRequestClose={() => setOpen(false)}
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
                  paddingBottom: 16,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${label} editor`}
                  onPress={() => setOpen(false)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.inputBg,
                  }}
                >
                  <X size={22} color={colors.text} />
                </Pressable>
                <Text
                  accessibilityRole="header"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: '600',
                    color: colors.text,
                  }}
                >
                  {label}
                </Text>
                <View style={{ width: 44 }} />
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={profileFieldStyles(colors).content}
              >
                {children(() => setOpen(false))}
              </ScrollView>
            </KeyboardAvoidingView>
          </SheetContent>
        </Modal>
      )}
    </>
  );
}

function TextDraft({
  label,
  value,
  onChange,
  close,
  hint,
  ...props
}: Omit<TextInputProps, 'onChange'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  close: () => void;
  hint?: string;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);
  function done() {
    onChange(draft);
    close();
  }
  return (
    <View style={{ gap: 16 }}>
      <Text style={profileFieldStyles(colors).label}>{label}</Text>
      <ProfileTextInput
        {...props}
        accessibilityLabel={label}
        value={draft}
        onChangeText={setDraft}
        autoFocus
        returnKeyType={props.multiline ? 'default' : 'done'}
        onSubmitEditing={props.multiline ? undefined : done}
      />
      {hint ? <Text style={{ color: colors.textMuted }}>{hint}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Done editing ${label}`}
        onPress={done}
        style={{
          minHeight: 48,
          borderRadius: 12,
          backgroundColor: colors.teal,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.tealFg, fontSize: 16, fontWeight: '600' }}>
          Done
        </Text>
      </Pressable>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        Save the section to confirm your changes.
      </Text>
    </View>
  );
}

export function ProfileTextField({
  label,
  value,
  onChange,
  disabled,
  hint,
  ...props
}: Omit<TextInputProps, 'onChange'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <ProfileFieldEditor label={label} value={value} disabled={disabled}>
      {(close) => (
        <TextDraft
          {...props}
          label={label}
          value={value}
          onChange={onChange}
          close={close}
          hint={hint}
        />
      )}
    </ProfileFieldEditor>
  );
}
