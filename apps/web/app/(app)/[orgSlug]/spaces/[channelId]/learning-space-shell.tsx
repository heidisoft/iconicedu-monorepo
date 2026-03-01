'use client';

import type {
  ChannelVM,
  LearningSpaceVM,
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
  MessageVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { LearningSpaceInfoPanel } from '@iconicedu/ui-web';
import { MessagesShellClient } from '@iconicedu/web/app/(app)/[orgSlug]/messages/messages-shell-client';

export function LearningSpaceShell({
  channel,
  learningSpace,
  currentUserId,
  currentUserProfile,
  readOnly = false,
  sendTextMessage,
  sendFileMessage,
  sendFilesMessage,
  toggleReaction,
  toggleSavedMessage,
  deleteMessage,
  toggleHiddenMessage,
}: {
  channel: ChannelVM;
  learningSpace: LearningSpaceVM | null;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  readOnly?: boolean;
  sendTextMessage: (input: MessageSendTextInput) => Promise<MessageVM>;
  sendFileMessage: (input: MessageSendFileInput) => Promise<MessageVM>;
  sendFilesMessage: (input: MessageSendFilesInput) => Promise<MessageVM>;
  toggleReaction: (input: { orgId: string; messageId: string; emoji: string }) => Promise<void>;
  toggleSavedMessage: (input: { orgId: string; messageId: string; isSaved: boolean }) => Promise<void>;
  deleteMessage: (input: { orgId: string; messageId: string }) => Promise<void>;
  toggleHiddenMessage: (input: { orgId: string; messageId: string; isHidden: boolean }) => Promise<void>;
}) {
  return (
    <MessagesShellClient
      channel={channel}
      currentUserId={currentUserId}
      currentUserProfile={currentUserProfile}
      readOnly={readOnly}
      panelRegistry={{
        channel_info: (props) => (
          <LearningSpaceInfoPanel {...props} learningSpace={learningSpace} />
        ),
      }}
      sendTextMessage={sendTextMessage}
      sendFileMessage={sendFileMessage}
      sendFilesMessage={sendFilesMessage}
      toggleReaction={toggleReaction}
      toggleSavedMessage={toggleSavedMessage}
      deleteMessage={deleteMessage}
      toggleHiddenMessage={toggleHiddenMessage}
    />
  );
}
