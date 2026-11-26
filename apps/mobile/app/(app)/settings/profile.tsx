import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useProfile } from '@/hooks/use-profile';
import { ProfileEditor } from '@/components/profile/profile-editor';

export default function ProfileSettingsScreen() {
  const { data: profile } = useProfile();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const selectedId = typeof profileId === 'string' ? profileId : undefined;
  return (
    <ProfileEditor
      id={selectedId ?? profile?.id ?? undefined}
      child={selectedId !== undefined}
      profileOnly
    />
  );
}
