'use client';

import { memo, useMemo, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import type { MessagesContainerProps } from './messages-container';
import { MessagesContainer } from './messages-container';
import { MessagesContainerHeader } from './messages-container-header';
import { MessagesContainerHeaderActions } from './messages-container-header-actions';
import { MessagesTopSurface } from './messages-top-surface';
import {
  MessagesStateProvider,
  useMessagesState,
} from './context/messages-state-provider';
import { MessagesRightSidebarRegion } from './messages-right-sidebar-region';
import { ChannelInfoPanel } from './panels/channel-info-panel';
import { ProfilePanel } from './panels/profile-panel';
import { SavedPanel } from './panels/saved-panel';
import type {
  MessagesRightPanelRegistry,
  MessagesRightPanelIntent,
} from '@iconicedu/shared-types';
import { useHasHydrated, useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@iconicedu/ui-web/ui/resizable';

interface MessagesRightPanelProps {
  intent: MessagesRightPanelIntent;
}

type MessagesShellProps = MessagesContainerProps & {
  panelRegistry?: Partial<
    MessagesRightPanelRegistry<ComponentType<MessagesRightPanelProps>>
  >;
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
      thread: () => null,
    };
    return { ...defaultRegistry, ...(props.panelRegistry ?? {}) };
  }, [props.panelRegistry]);

  return (
    <MessagesStateProvider
      channel={channel}
      isReadOnly={props.readOnly}
      showCreateMessageTypeButton={props.showCreateMessageTypeButton}
    >
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

  const messagesHeader = (
    <MessagesTopSurface channel={props.channel} data-testid="messages-top-surface-header">
      <header className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
        <MessagesContainerHeader channel={props.channel} />
        <MessagesContainerHeaderActions />
      </header>
    </MessagesTopSurface>
  );

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
        {messagesHeader}
        <div className="flex flex-1 overflow-hidden">
          {mainContent}
          <MessagesRightSidebarRegion registry={registry} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-w-0 min-h-0">
          <ResizablePanel
            defaultSize={state.isOpen ? 60 : 100}
            minSize={50}
            className="min-w-0 min-h-0 flex flex-col"
          >
            {messagesHeader}
            {mainContent}
          </ResizablePanel>
          {state.isOpen ? (
            <>
              <ResizableHandle withHandle className="animate-in fade-in-0 duration-200" />
              <ResizablePanel
                defaultSize={40}
                minSize={30}
                maxSize={45}
                className="min-w-0 min-h-0 flex flex-col animate-in slide-in-from-right-2 fade-in-0 duration-200"
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
