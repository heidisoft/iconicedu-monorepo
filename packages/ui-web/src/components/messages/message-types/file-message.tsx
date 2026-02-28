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

export const FileMessage = memo(function FileMessage(props: FileMessageProps) {
  const { message, ...baseProps } = props;

  return (
    <MessageBase message={message} {...baseProps}>
      {message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 max-w-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {message.attachment.name}
          </p>
          {message.attachment.size && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(message.attachment.size)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          aria-label="Download file"
          onClick={() => {
            window.open(
              buildFileDownloadHref({
                url: message.attachment.url,
                storagePath: message.attachment.storagePath,
              }),
              '_blank',
              'noopener,noreferrer',
            );
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </MessageBase>
  );
});
