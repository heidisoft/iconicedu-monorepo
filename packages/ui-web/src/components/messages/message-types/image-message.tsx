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

export function getImageAttachments(message: ImageMessageType) {
  return message.attachments?.length ? message.attachments : [message.attachment];
}

export function getImageDownloadHref(message: Pick<ImageMessageType, 'attachment'>) {
  return buildFileDownloadHref({
    url: message.attachment.url,
    storagePath: message.attachment.storagePath,
  });
}

export const ImageMessage = memo(function ImageMessage(props: ImageMessageProps) {
  const { message, ...baseProps } = props;
  const attachments = getImageAttachments(message);
  const isGallery = attachments.length > 1;

  return (
    <MessageBase message={message} {...baseProps}>
      {message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      <div
        className={
          isGallery
            ? 'grid max-w-[30rem] grid-cols-2 gap-2'
            : 'relative max-w-sm overflow-hidden rounded-xl border border-border'
        }
      >
        {attachments.map((attachment, index) => (
          <div
            key={`${attachment.storagePath ?? attachment.name}-${index}`}
            className={
              isGallery
                ? 'group relative overflow-hidden rounded-xl border border-border bg-muted/20'
                : 'group relative'
            }
          >
            <img
              src={attachment.url || '/placeholder.svg'}
              alt={attachment.name}
              className={isGallery ? 'h-48 w-full object-cover' : 'h-auto w-full'}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/85 backdrop-blur"
              aria-label={`Download ${attachment.name}`}
              onClick={() => {
                window.open(
                  getImageDownloadHref({ attachment }),
                  '_blank',
                  'noopener,noreferrer',
                );
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </MessageBase>
  );
});
