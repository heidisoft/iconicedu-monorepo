import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CreditCard,
  Camera,
  User,
  GraduationCap,
  MapPin,
  Settings,
  Mail,
} from 'lucide-react-native';
import { SettingsRow } from '@iconicedu/ui-native';
import {
  normalizeCountryCode,
  optionsForCountry,
  type ProfileSettingsSection,
} from '@iconicedu/shared-types';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/theme-provider';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import type { ProfileSettingsResult } from '@/lib/api/profile-settings';
import type { AppColors } from '@/lib/theme';
import { type ProfileItem } from './profile-item-editor';

import { AvatarImage } from '@/components/profile/avatar-image';
export function ProfileDetails({
  data,
  child,
  onEdit,
  onEditItem,
  onRemove,
  busy,
  draft = false,
  overview = false,
  header,
  extraSections,
  sectionsContent,
  footer,
  onInvite,
}: {
  data: ProfileSettingsResult;
  child: boolean;
  onEdit: (section: ProfileSettingsSection) => void;
  onEditItem?: (field: ProfileItem) => void;
  onRemove: () => void;
  busy: boolean;
  draft?: boolean;
  overview?: boolean;
  header?: React.ReactNode;
  extraSections?: React.ReactNode;
  sectionsContent?: React.ReactNode;
  footer?: React.ReactNode;
  onInvite?: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const s = styles(colors);
  const p = data.profile;
  const value = (key: string) => (typeof p[key] === 'string' ? (p[key] as string) : '');
  const displayName =
    value('display_name') || value('first_name') || (draft ? 'New child' : 'User');
  const accent = profileAvatarColors({
    seed: String(p.id),
    themeKey: value('ui_theme_key'),
  });
  const icon = (Icon: typeof User) => <Icon size={20} color={colors.textMuted} />;
  function section(
    title: string,
    key: ProfileSettingsSection,
    children: React.ReactNode,
  ) {
    return (
      <View key={key}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>{title}</Text>
        </View>
        {children}
      </View>
    );
  }
  const rowFields: Record<string, ProfileItem> = {
    'Display Name': 'display_name',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    Bio: 'bio',
    'Birth Year': 'birth_year',
    Grade: 'grade_level',
  };
  function row(
    label: string,
    content: string | undefined | null,
    Icon = User,
    last = false,
  ) {
    return (
      <React.Fragment key={label}>
        <SettingsRow
          icon={icon(Icon)}
          label={label}
          labelColor={colors.text}
          hideChevron
          onPress={
            data.canEdit && !draft && !busy && onEditItem && rowFields[label]
              ? () => onEditItem(rowFields[label]!)
              : undefined
          }
          trailing={
            <Text
              style={content ? s.value : s.empty}
              numberOfLines={label === 'Bio' ? 4 : 2}
            >
              {content || 'Not set'}
            </Text>
          }
        />
        {!last && <View style={s.divider} />}
      </React.Fragment>
    );
  }
  const gradeLabel =
    optionsForCountry(normalizeCountryCode(value('country_code'))).find(
      (option) => option.value === data.gradeLevel,
    )?.label ?? data.gradeLevel;
  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {header}
      <View style={s.avatarSection}>
        {value('avatar_url') ? (
          <AvatarImage
            accessibilityLabel="Profile photo"
            uri={value('avatar_url')}
            style={s.avatar}
          />
        ) : (
          <View style={[s.avatar, { backgroundColor: accent.bg }]}>
            <Text style={[s.avatarText, { color: accent.fg }]}>
              {displayName[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        {data.canEdit && !draft && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Photo"
            accessibilityHint="Take a photo or choose from your album"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => onEdit('photo')}
            style={s.edit}
          >
            <Camera size={20} color={colors.teal} />
          </Pressable>
        )}
        {data.canEdit && !draft ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile name"
            accessibilityHint="Opens the identity editor for first, last and display names"
            accessibilityValue={{ text: displayName }}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => onEditItem?.('display_name')}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Text style={s.avatarName}>{displayName}</Text>
          </Pressable>
        ) : (
          <Text style={s.avatarName}>{displayName}</Text>
        )}
      </View>
      {sectionsContent ??
        (!overview && (
          <>
            {section(
              'Identity',
              'identity',
              <View style={s.card}>
                {row('Display Name', value('display_name'))}
                {row('First Name', value('first_name'))}
                {row('Last Name', value('last_name'), User, true)}
              </View>,
            )}
            {!draft &&
              (value('bio') || data.canEdit) &&
              section(
                'About',
                'about',
                <View style={s.card}>{row('Bio', value('bio'), CreditCard, true)}</View>,
              )}
            {child &&
              section(
                'Learning Details',
                'child',
                <View style={s.card}>
                  {row(
                    'Birth Year',
                    data.childDetails?.birth_year
                      ? String(data.childDetails.birth_year)
                      : '',
                    GraduationCap,
                  )}
                  {row('Grade', gradeLabel, GraduationCap, true)}
                </View>,
              )}
          </>
        ))}
      {extraSections}
      {child && !draft && overview && (
        <>
          <Text style={s.sectionLabel}>Personal</Text>
          <View style={s.card}>
            <SettingsRow
              icon={icon(User)}
              label="Profile"
              labelColor={colors.text}
              onPress={() =>
                router.push({
                  pathname: '/(app)/settings/profile',
                  params: { profileId: String(p.id) },
                })
              }
            />
            <View style={s.divider} />
            <SettingsRow
              icon={icon(MapPin)}
              label="Location"
              labelColor={colors.text}
              onPress={() =>
                router.push({
                  pathname: '/(app)/settings/location',
                  params: { profileId: String(p.id) },
                })
              }
            />
          </View>
          <Text style={s.sectionLabel}>Account</Text>
          <View style={s.card}>
            <SettingsRow
              icon={icon(Settings)}
              label="Preferences"
              labelColor={colors.text}
              onPress={() =>
                router.push({
                  pathname: '/(app)/settings/preferences',
                  params: { profileId: String(p.id) },
                })
              }
            />
          </View>
        </>
      )}
      {child && !draft && overview && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Sign-in</Text>
            {data.canInvite && !data.childAccount?.hasAuthAccount && onInvite && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Invite child by email"
                disabled={busy}
                onPress={onInvite}
                style={s.edit}
              >
                <Text style={s.editText}>Invite</Text>
              </Pressable>
            )}
          </View>
          <View style={s.card}>
            {row('Email', data.childAccount?.email, Mail)}
            {row(
              'Account',
              data.childAccount?.hasAuthAccount ? 'Sign-in enabled' : 'Managed by parent',
              User,
              true,
            )}
          </View>
        </>
      )}
      {!data.canEdit && (
        <Text style={s.hint}>
          Your family permissions allow viewing these details only.
        </Text>
      )}
      {child && overview && data.canRemove && (
        <>
          <Text style={s.sectionLabel}>Manage Child</Text>
          <View style={s.card}>
            <SettingsRow
              icon={<User size={20} color={colors.red} />}
              label={
                data.removalBlocked ? 'Contact support to remove child' : 'Remove child'
              }
              labelColor={colors.red}
              onPress={busy ? undefined : onRemove}
            />
          </View>
        </>
      )}
      {footer}
    </ScrollView>
  );
}
const styles = (C: AppColors) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 48, gap: 6 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 4,
      marginTop: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    edit: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    editText: { color: C.teal, fontSize: 15, fontWeight: '600' },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      overflow: 'hidden',
    },
    divider: { height: 1, backgroundColor: C.border, marginLeft: 60 },
    value: { fontSize: 14, color: C.textMuted, maxWidth: 160, textAlign: 'right' },
    empty: { fontSize: 14, color: C.textFaint, fontStyle: 'italic' },
    avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontWeight: '800', fontSize: 34 },
    avatarName: { fontSize: 22, fontWeight: '800', color: C.text },
    hint: { fontSize: 13, color: C.textMuted, padding: 4 },
  });
