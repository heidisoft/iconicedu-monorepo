'use client';

import { memo, useMemo } from 'react';
import type { ComponentType } from 'react';
import type {
  MessagesRightPanelIntent,
  MessagesRightPanelRegistry,
} from '@iconicedu/shared-types';
import { MessagesSidebar } from '@iconicedu/ui-web/components/messages/messages-sidebar';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
interface MessagesRightSidebarRegionProps {
  registry: MessagesRightPanelRegistry<ComponentType<MessagesRightPanelProps>>;
  layout?: 'fixed' | 'resizable';
}

interface MessagesRightPanelProps {
  intent: MessagesRightPanelIntent;
}

const getSidebarMeta = (intent: MessagesRightPanelIntent | null) => {
  if (!intent) return { title: '', subtitle: undefined };
  switch (intent.key) {
    case 'channel_info':
      return { title: 'Details', subtitle: undefined };
    case 'saved':
      return { title: 'Saved Messages', subtitle: undefined };
    case 'profile':
      return { title: 'Profile', subtitle: undefined };
    case 'thread':
      return { title: 'Thread', subtitle: undefined };
    case 'pinned':
      return { title: 'Pinned Messages', subtitle: undefined };
    case 'search':
      return { title: 'Search Messages', subtitle: undefined };
    case 'scheduled':
      return { title: 'Scheduled Messages', subtitle: undefined };
    default:
      return { title: '', subtitle: undefined };
  }
};

export const MessagesRightSidebarRegion = memo(function MessagesRightSidebarRegion({
  registry,
  layout = 'fixed',
}: MessagesRightSidebarRegionProps) {
  const { state, close } = useMessagesState();

  const Panel = useMemo(() => {
    if (!state.intent) return null;
    return registry[state.intent.key];
  }, [registry, state.intent]);

  const meta = getSidebarMeta(state.intent);

  return (
    <MessagesSidebar
      open={state.isOpen}
      title={meta.title}
      subtitle={meta.subtitle}
      onClose={close}
      layout={layout}
      className="min-w-0 flex-1 h-full"
    >
      {Panel && state.intent ? <Panel intent={state.intent} /> : null}
    </MessagesSidebar>
  );
});
