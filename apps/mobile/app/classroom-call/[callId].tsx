import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ClassroomCallDetails } from '@/components/classroom/classroom-call-details';
export default function ClassroomCallRoute() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  return <ClassroomCallDetails key={callId} callId={callId} />;
}
