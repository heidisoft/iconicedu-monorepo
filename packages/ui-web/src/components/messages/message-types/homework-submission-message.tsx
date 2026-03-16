import { memo } from 'react';
import { FileText, Clock, Download, Award, Send, AlertCircle } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { HomeworkSubmissionMessageVM as HomeworkSubmissionMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface HomeworkSubmissionMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: HomeworkSubmissionMessageType;
}

const homeworkStatusConfig = {
  submitted: {
    label: 'Submitted',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: Send,
  },
  graded: {
    label: 'Graded',
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
    icon: Award,
  },
  'needs-revision': {
    label: 'Needs Revision',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    icon: AlertCircle,
  },
};

export const HomeworkSubmissionMessage = memo(function HomeworkSubmissionMessage(
  props: HomeworkSubmissionMessageProps,
) {
  const { message, ...baseProps } = props;
  const { homework } = message;
  const statusInfo = homeworkStatusConfig[homework.status];
  const StatusIcon = statusInfo.icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-blue-500/5">
      {message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      <div className="rounded-xl border border-blue-500/20 bg-card overflow-hidden max-w-md">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Homework Submission
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {homework.assignmentTitle}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={cn('gap-1', statusInfo.color)}>
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Clock className="h-3 w-3" />
            <span>Submitted: {formatDate(homework.submittedAt)}</span>
          </div>

          {homework.attachments && homework.attachments.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Attachments:
              </p>
              <div className="flex flex-col gap-2">
                {homework.attachments.map((attachment, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-2"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 text-xs truncate text-foreground">
                      {attachment.name}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {homework.status === 'graded' && homework.grade && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Grade:</span>
                <Badge variant="secondary" className="gap-1">
                  <Award className="h-3 w-3" />
                  {homework.grade}
                </Badge>
              </div>
              {homework.feedback && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Feedback:
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">
                    {homework.feedback}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MessageBase>
  );
});
