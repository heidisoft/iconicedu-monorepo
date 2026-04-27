'use client';

import { memo, useState } from 'react';
import { Download } from 'lucide-react';
import type { ImageMessageVM as ImageMessageType } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@iconicedu/ui-web/ui/dialog';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import {
  buildFileDownloadHref,
  buildImageRenderHref,
} from '@iconicedu/ui-web/components/messages/file-download.utils';

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
  const isFeedTheme = baseProps.messageUiThemeKey === 'feed';
  const [previewAttachment, setPreviewAttachment] = useState<
    (typeof attachments)[number] | null
  >(null);

  const renderImageTile = (
    attachment: (typeof attachments)[number],
    index: number,
    imageClassName: string,
    wrapperClassName = 'group relative overflow-hidden rounded-xl border border-border bg-muted/20',
    overflowCount = 0,
  ) => (
    <div
      key={`${attachment.storagePath ?? attachment.name}-${index}`}
      className={wrapperClassName}
    >
      <button
        type="button"
        className="block h-full w-full cursor-zoom-in"
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
          className={imageClassName}
        />
        {overflowCount > 0 ? (
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/55 text-lg font-bold text-background">
            {overflowCount}+
          </span>
        ) : null}
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
  );

  const renderFeedImages = () => {
    if (attachments.length === 1) {
      return renderImageTile(
        attachments[0]!,
        0,
        'h-full w-full object-cover',
        'group relative aspect-[4/3] min-h-[18rem] w-full overflow-hidden rounded-xl border border-border bg-muted/20 sm:min-h-[24rem] lg:min-h-[30rem]',
      );
    }

    if (attachments.length === 2) {
      return (
        <div className="flex w-full gap-2.5">
          {attachments.map((attachment, index) =>
            renderImageTile(
              attachment,
              index,
              'h-full w-full object-cover',
              'group relative aspect-square flex-1 overflow-hidden rounded-xl border border-border bg-muted/20',
            ),
          )}
        </div>
      );
    }

    const visible = attachments.slice(0, 5);
    const overflow = Math.max(0, attachments.length - 4);

    return (
      <div className="grid w-full grid-cols-2 gap-2.5">
        {renderImageTile(
          visible[0]!,
          0,
          'h-full w-full object-cover',
          'group relative row-span-2 min-h-full overflow-hidden rounded-xl border border-border bg-muted/20',
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {visible
            .slice(1, 5)
            .map((attachment, index) =>
              renderImageTile(
                attachment,
                index + 1,
                'h-full w-full object-cover',
                'group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted/20',
                index === 3 ? overflow : 0,
              ),
            )}
        </div>
      </div>
    );
  };

  return (
    <MessageBase message={message} {...baseProps}>
      {!isFeedTheme && message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      {isFeedTheme ? (
        renderFeedImages()
      ) : (
        <div
          className={
            isGallery
              ? 'grid max-w-[30rem] grid-cols-2 gap-2'
              : 'relative max-w-sm overflow-hidden rounded-xl border border-border'
          }
        >
          {attachments.map((attachment, index) =>
            renderImageTile(
              attachment,
              index,
              isGallery ? 'h-48 w-full object-cover' : 'h-auto w-full',
              isGallery
                ? 'group relative overflow-hidden rounded-xl border border-border bg-muted/20'
                : 'group relative',
            ),
          )}
        </div>
      )}
      {isFeedTheme && message.content?.text && (
        <p className="mt-3 rounded-[10px] border border-border/70 bg-background px-4 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {message.content.text}
        </p>
      )}
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
