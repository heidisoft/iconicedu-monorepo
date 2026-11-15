'use client';
import dynamic from 'next/dynamic';
export const MeetingRolesEntry = dynamic(
  () => import('./meeting-roles-fixture').then((module) => module.MeetingRolesFixture),
  { ssr: false },
);
