import { SheetContent } from '@iconicedu/ui-native/components/sheet-content';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProfileSettingsSection } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { chooseProfilePhoto } from '@/lib/profile-photo-picker';
import { fetchProfileSettings, removeFamilyChild } from '@/lib/api/profile-settings';
import { ProfileDetails } from './profile-details';
import { ProfileSectionForm, sectionTitles } from './profile-section-form';
import { AddChildDraft } from './add-child-draft';
export function ProfileEditor({
  id,
  child = false,
  create = false,
  profileOnly = false,
}: {
  id?: string;
  child?: boolean;
  create?: boolean;
  profileOnly?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const query = useQuery({
    queryKey: ['profile-settings', id],
    queryFn: () => fetchProfileSettings(id!),
    enabled: !!id && !create,
  });
  const [editingSection, setEditingSection] = useState<ProfileSettingsSection | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [initialPhoto, setInitialPhoto] = useState<string | null>(null);
  async function editSection(section: ProfileSettingsSection) {
    if (!query.data?.canEdit || removing || pickingPhoto) return;
    if (section !== 'photo') {
      setEditingSection(section);
      return;
    }
    setPickingPhoto(true);
    try {
      const photo = await chooseProfilePhoto();
      if (photo) {
        setInitialPhoto(photo);
        setEditingSection('photo');
      }
    } finally {
      setPickingPhoto(false);
    }
  }
  const client = useQueryClient();
  const family = useFamilyView();
  function remove() {
    if (!query.data?.canRemove || removing) return;
    if (query.data.removalBlocked) {
      Alert.alert(
        'Contact support to remove child',
        'This child has class assignments or another guardian. Open Account → Live Support and provide the child’s name and class details to request removal.',
      );
      return;
    }
    Alert.alert(
      'Remove child?',
      `Remove ${String(query.data.profile.display_name || 'this child')} from your family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove child',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeFamilyChild(id!);
              await client.invalidateQueries();
              await family.refresh();
              router.back();
            } catch (e) {
              Alert.alert(
                'Unable to remove child',
                e instanceof Error ? e.message : 'Please try again.',
              );
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  }
  const profile = query.data
    ? {
        ...query.data.profile,
        birth_year: query.data.childDetails?.birth_year,
        grade_level: query.data.gradeLevel,
      }
    : {};
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={{ padding: 8 }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontSize: 19,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
            marginRight: 40,
          }}
        >
          {create ? 'Add child' : child && !profileOnly ? 'Child details' : 'Profile'}
        </Text>
      </View>
      {create ? (
        <AddChildDraft />
      ) : query.isPending ? (
        <Text style={{ color: colors.text, padding: 20 }}>Loading profile…</Text>
      ) : query.isError || !query.data ? (
        <Pressable onPress={() => void query.refetch()}>
          <Text style={{ color: colors.text, padding: 20 }}>
            Unable to load profile. Tap to retry.
          </Text>
        </Pressable>
      ) : (
        <ProfileDetails
          data={query.data}
          child={child}
          overview={child && !profileOnly}
          onEdit={(section) => void editSection(section)}
          onInvite={() =>
            router.push({
              pathname: '/(app)/settings/invite-child',
              params: { profileId: id! },
            })
          }
          onRemove={remove}
          busy={removing || pickingPhoto}
        />
      )}
      {editingSection && query.data?.canEdit && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditingSection(null)}
        >
          <SheetContent backgroundColor={colors.pageBg}>
            <ProfileSectionForm
              key={editingSection}
              profile={profile}
              section={editingSection}
              initialPhoto={editingSection === 'photo' ? initialPhoto : null}
              onClose={() => setEditingSection(null)}
            />
          </SheetContent>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/** Reuses the same section editor without changing the surrounding settings rows. */
export function ProfileSectionEditButton({
  id,
  section,
  title,
}: {
  id?: string | null;
  section: ProfileSettingsSection;
  title?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['profile-settings', id],
    queryFn: () => fetchProfileSettings(id!),
    enabled: !!id,
  });
  if (!query.data?.canEdit) return null;
  const profile = {
    ...query.data.profile,
    birth_year: query.data.childDetails?.birth_year,
    grade_level: query.data.gradeLevel,
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title ?? sectionTitles[section]}`}
        onPress={() => setOpen(true)}
        style={{
          minWidth: 44,
          minHeight: 44,
          paddingHorizontal: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.teal }}>Edit</Text>
      </Pressable>
      {open && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setOpen(false)}
        >
          <SheetContent backgroundColor={colors.pageBg}>
            <ProfileSectionForm
              profile={profile}
              section={section}
              onClose={() => setOpen(false)}
            />
          </SheetContent>
        </Modal>
      )}
    </>
  );
}
