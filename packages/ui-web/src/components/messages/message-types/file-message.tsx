import { memo } from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '../../../ui/button';
import type { FileMessageVM as FileMessageType } from '@iconicedu/shared-types';
import { MessageBase, type MessageBaseProps } from '../message-base';
import { buildFileDownloadHref } from '../file-download.utils';

interface FileMessageProps extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: FileMessageType;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getFileAttachments(message: FileMessageType) {
  return message.attachments?.length ? message.attachments : [message.attachment];
}

export const FileMessage = memo(function FileMessage(props: FileMessageProps) {
  const { message, ...baseProps } = props;
  const attachments = getFileAttachments(message);

  return (
    <MessageBase message={message} {...baseProps}>
      {message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      <div className="max-w-sm overflow-hidden rounded-xl border border-border bg-muted/30">
        {attachments.map((attachment, index) => (
          <div
            key={`${attachment.storagePath ?? attachment.name}-${index}`}
            className={`flex items-center gap-3 p-3 ${
              index < attachments.length - 1 ? 'border-b border-border/70' : ''
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
              {attachment.size ? (
                <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              aria-label={`Download ${attachment.name}`}
              onClick={() => {
                window.open(
                  buildFileDownloadHref({
                    url: attachment.url,
                    storagePath: attachment.storagePath,
                  }),
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
