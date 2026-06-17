import { memo } from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import type { FileMessageVM as FileMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { buildFileDownloadHref } from '@iconicedu/ui-web/components/messages/file-download.utils';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';

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
  const isFeedTheme = baseProps.messageUiThemeKey === 'feed';

  return (
    <MessageBase message={message} {...baseProps}>
      {!isFeedTheme && message.content?.text && (
        <MessageTextContent text={message.content.text} className="mb-2" />
      )}
      <div className="max-w-sm overflow-hidden rounded-xl border border-border bg-card">
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
              <p className="truncate text-sm font-medium text-foreground">
                {attachment.name}
              </p>
              {attachment.size ? (
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>
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
      {isFeedTheme && message.content?.text && (
        <MessageTextContent
          text={message.content.text}
          className="mt-3 rounded-[10px] border border-border/70 bg-background px-4 py-3"
        />
      )}
    </MessageBase>
  );
});
