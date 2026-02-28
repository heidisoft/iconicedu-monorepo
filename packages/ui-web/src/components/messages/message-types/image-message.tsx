'use client';

import { memo } from 'react';
import { Download } from 'lucide-react';
import type { ImageMessageVM as ImageMessageType } from '@iconicedu/shared-types';
import { Button } from '../../../ui/button';
import { MessageBase, type MessageBaseProps } from '../message-base';
import { buildFileDownloadHref } from '../file-download.utils';

interface ImageMessageProps extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: ImageMessageType;
}

export function getImageDownloadHref(message: ImageMessageType) {
  return buildFileDownloadHref({
    url: message.attachment.url,
    storagePath: message.attachment.storagePath,
  });
}

export const ImageMessage = memo(function ImageMessage(props: ImageMessageProps) {
  const { message, ...baseProps } = props;

  return (
    <MessageBase message={message} {...baseProps}>
      {message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      <div className="relative overflow-hidden rounded-xl border border-border max-w-sm">
        <img
          src={message.attachment.url || '/placeholder.svg'}
          alt={message.attachment.name}
          className="w-full h-auto"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/85 backdrop-blur"
          aria-label="Download image"
          onClick={() => {
            window.open(getImageDownloadHref(message), '_blank', 'noopener,noreferrer');
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </MessageBase>
  );
});
