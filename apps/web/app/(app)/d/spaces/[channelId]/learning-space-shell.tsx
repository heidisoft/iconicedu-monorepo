'use client';

import type {
  ChannelVM,
  LearningSpaceVM,
  MessageSendTextInput,
  MessageVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { LearningSpaceInfoPanel } from '@iconicedu/ui-web';
import { MessagesShellClient } from '@iconicedu/web/app/(app)/d/messages/messages-shell-client';

export function LearningSpaceShell({
  channel,
  learningSpace,
  currentUserId,
  currentUserProfile,
  sendTextMessage,
  toggleReaction,
  deleteMessage,
}: {
  channel: ChannelVM;
  learningSpace: LearningSpaceVM | null;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  sendTextMessage: (input: MessageSendTextInput) => Promise<MessageVM>;
  toggleReaction: (input: { orgId: string; messageId: string; emoji: string }) => Promise<void>;
  deleteMessage: (input: { orgId: string; messageId: string }) => Promise<void>;
}) {
  return (
    <MessagesShellClient
      channel={channel}
      currentUserId={currentUserId}
      currentUserProfile={currentUserProfile}
      panelRegistry={{
        channel_info: (props) => (
          <LearningSpaceInfoPanel {...props} learningSpace={learningSpace} />
        ),
      }}
      sendTextMessage={sendTextMessage}
      toggleReaction={toggleReaction}
      deleteMessage={deleteMessage}
    />
  );
}
