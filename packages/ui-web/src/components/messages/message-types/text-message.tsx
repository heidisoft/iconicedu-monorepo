import { memo } from 'react';
import type { TextMessageVM as TextMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';

interface TextMessageProps extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: TextMessageType;
}

export const TextMessage = memo(function TextMessage(props: TextMessageProps) {
  const { message, ...baseProps } = props;

  return (
    <MessageBase message={message} {...baseProps}>
      <MessageTextContent
        text={message.content.text}
        mentions={message.content.mentions}
      />
    </MessageBase>
  );
});
