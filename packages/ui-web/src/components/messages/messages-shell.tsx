'use client';

import { memo, useMemo, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import type { MessagesContainerProps } from '@iconicedu/ui-web/components/messages/messages-container';
import { MessagesContainer } from '@iconicedu/ui-web/components/messages/messages-container';
import { MessagesContainerHeader } from '@iconicedu/ui-web/components/messages/messages-container-header';
import { MessagesContainerHeaderActions } from '@iconicedu/ui-web/components/messages/messages-container-header-actions';
import {
  MessagesStateProvider,
  useMessagesState,
} from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { MessagesRightSidebarRegion } from '@iconicedu/ui-web/components/messages/messages-right-sidebar-region';
import { ChannelInfoPanel } from '@iconicedu/ui-web/components/messages/panels/channel-info-panel';
import { ProfilePanel } from '@iconicedu/ui-web/components/messages/panels/profile-panel';
import { SavedPanel } from '@iconicedu/ui-web/components/messages/panels/saved-panel';
import { ThreadPanel } from '@iconicedu/ui-web/components/messages/panels/thread-panel';
import type {
  MessagesRightPanelRegistry,
  MessagesRightPanelIntent,
} from '@iconicedu/shared-types';
import { useHasHydrated, useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@iconicedu/ui-web/ui/resizable';

interface MessagesRightPanelProps {
  intent: MessagesRightPanelIntent;
}

type MessagesShellProps = MessagesContainerProps & {
  panelRegistry?: Partial<MessagesRightPanelRegistry<ComponentType<MessagesRightPanelProps>>>;
};

export const MessagesShell = memo(function MessagesShell(props: MessagesShellProps) {
  const { channel } = props;

  const rightPanelRegistry = useMemo<
    MessagesRightPanelRegistry<ComponentType<MessagesRightPanelProps>>
  >(() => {
    const defaultRegistry: MessagesRightPanelRegistry<
      ComponentType<MessagesRightPanelProps>
    > = {
      channel_info: ChannelInfoPanel,
      saved: SavedPanel,
      profile: ProfilePanel,
      thread: ThreadPanel,
    };
    return { ...defaultRegistry, ...(props.panelRegistry ?? {}) };
  }, [props.panelRegistry]);

  return (
    <MessagesStateProvider channel={channel} isReadOnly={props.readOnly}>
      <MessagesShellLayout {...props} registry={rightPanelRegistry} />
    </MessagesStateProvider>
  );
});

interface MessagesShellLayoutProps extends MessagesShellProps {
  registry: MessagesRightPanelRegistry<ComponentType<MessagesRightPanelProps>>;
}

const MessagesShellLayout = memo(function MessagesShellLayout({
  registry,
  ...props
}: MessagesShellLayoutProps) {
  const isMobile = useIsMobile();
  const hasHydrated = useHasHydrated();
  const { state, open } = useMessagesState();
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    if (!hasHydrated || isMobile || hasAutoOpened.current || state.isOpen) return;
    if (!props.channel.ui?.defaultRightPanelOpen) return;
    const defaultKey = props.channel.ui?.defaultRightPanelKey ?? 'channel_info';
    if (defaultKey === 'profile' || defaultKey === 'thread') return;
    open({ key: defaultKey });
    hasAutoOpened.current = true;
  }, [
    hasHydrated,
    isMobile,
    open,
    props.channel.ui?.defaultRightPanelKey,
    props.channel.ui?.defaultRightPanelOpen,
    state.isOpen,
  ]);

  const mainContent = (
    <div className="flex min-h-0 flex-1 min-w-0 flex-col">
      <MessagesContainer {...props} />
    </div>
  );

  const rightPanel = (
    <MessagesRightSidebarRegion registry={registry} layout="resizable" />
  );

  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <MessagesContainerHeader channel={props.channel} />
          <MessagesContainerHeaderActions />
        </header>
        <div className="flex flex-1 overflow-hidden">
          {mainContent}
          <MessagesRightSidebarRegion registry={registry} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <MessagesContainerHeader channel={props.channel} />
        <MessagesContainerHeaderActions />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-w-0 min-h-0">
          <ResizablePanel
            defaultSize={state.isOpen ? 60 : 100}
            minSize={50}
            className="min-w-0 min-h-0 flex flex-col"
          >
            {mainContent}
          </ResizablePanel>
          {state.isOpen ? (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={40}
                minSize={30}
                maxSize={45}
                className="min-w-0 min-h-0 flex flex-col"
              >
                {rightPanel}
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
    </div>
  );
});
