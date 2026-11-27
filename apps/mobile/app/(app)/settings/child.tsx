import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ProfileEditor } from '@/components/profile/profile-editor';

export default function ChildSettingsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ProfileEditor id={id} child create={!id} />;
}
