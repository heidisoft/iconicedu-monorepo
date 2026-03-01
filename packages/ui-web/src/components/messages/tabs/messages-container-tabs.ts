import type { LucideIcon } from 'lucide-react';
import { Bookmark, CalendarDays, FileText, MessageCircle, Users } from 'lucide-react';

export type MessagesContainerTabKey =
  | 'messages'
  | 'files'
  | 'schedule'
  | 'saved'
  | 'members';

export interface MessagesContainerTabDefinition {
  key: MessagesContainerTabKey;
  label: string;
  icon: LucideIcon;
}

const BASE_TABS: MessagesContainerTabDefinition[] = [
  { key: 'messages', label: 'Messages', icon: MessageCircle },
  { key: 'files', label: 'Files', icon: FileText },
];

const SAVED_TAB: MessagesContainerTabDefinition = {
  key: 'saved',
  label: 'Saved',
  icon: Bookmark,
};

const SCHEDULE_TAB: MessagesContainerTabDefinition = {
  key: 'schedule',
  label: 'Sessions',
  icon: CalendarDays,
};

const MEMBERS_TAB: MessagesContainerTabDefinition = {
  key: 'members',
  label: 'Members',
  icon: Users,
};

export function getMessagesContainerTabs(
  enableScheduleTab: boolean,
): MessagesContainerTabDefinition[] {
  if (!enableScheduleTab) return [...BASE_TABS, SAVED_TAB, MEMBERS_TAB];
  return [BASE_TABS[0], SCHEDULE_TAB, BASE_TABS[1], SAVED_TAB, MEMBERS_TAB];
}
