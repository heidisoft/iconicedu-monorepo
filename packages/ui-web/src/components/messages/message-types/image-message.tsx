'use client';

import { memo, useState } from 'react';
import { Download } from 'lucide-react';
import type { ImageMessageVM as ImageMessageType } from '@iconicedu/shared-types';
import { Button } from '../../../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../../../ui/dialog';
import { MessageBase, type MessageBaseProps } from '../message-base';
import { buildFileDownloadHref, buildImageRenderHref } from '../file-download.utils';

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

export function getImageRenderSrc(message: Pick<ImageMessageType, 'attachment'>) {
  return buildImageRenderHref({
    url: message.attachment.url,
    storagePath: message.attachment.storagePath,
    thumbnailUrl:
      'thumbnailUrl' in message.attachment ? message.attachment.thumbnailUrl : undefined,
  });
}

export function getFullImageRenderSrc(message: Pick<ImageMessageType, 'attachment'>) {
  return buildImageRenderHref({
    url: message.attachment.url,
    storagePath: message.attachment.storagePath,
  });
}

export const ImageMessage = memo(function ImageMessage(props: ImageMessageProps) {
  const { message, ...baseProps } = props;
  const attachments = getImageAttachments(message);
  const isGallery = attachments.length > 1;
  const [previewAttachment, setPreviewAttachment] = useState<
    (typeof attachments)[number] | null
  >(null);

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
            <button
              type="button"
              className="block w-full cursor-zoom-in"
              aria-label={`View ${attachment.name} full size`}
              onClick={() => setPreviewAttachment(attachment)}
            >
              <img
                src={
                  buildImageRenderHref({
                    url: attachment.url,
                    storagePath: attachment.storagePath,
                    thumbnailUrl:
                      'thumbnailUrl' in attachment ? attachment.thumbnailUrl : undefined,
                  }) || '/placeholder.svg'
                }
                alt={attachment.name}
                className={isGallery ? 'h-48 w-full object-cover' : 'h-auto w-full'}
              />
            </button>
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
      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent className="max-w-[min(95vw,72rem)] border-border/60 bg-black/95 p-3 sm:p-4">
          <DialogTitle className="sr-only">
            {previewAttachment?.name ?? 'Image preview'}
          </DialogTitle>
          {previewAttachment ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-16 top-4 z-10 h-8 w-8 rounded-full bg-background/85 backdrop-blur"
                aria-label={`Download ${previewAttachment.name}`}
                onClick={() => {
                  window.open(
                    getImageDownloadHref({ attachment: previewAttachment }),
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <div className="flex max-h-[85vh] min-h-[40vh] items-center justify-center">
                <img
                  src={
                    getFullImageRenderSrc({ attachment: previewAttachment }) ||
                    '/placeholder.svg'
                  }
                  alt={previewAttachment.name}
                  className="max-h-[80vh] max-w-full object-contain"
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </MessageBase>
  );
});
