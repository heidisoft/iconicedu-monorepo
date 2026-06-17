'use client';

import { memo } from 'react';
import { BookOpen, Calendar, Clock, FileText, Download } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { LessonAssignmentMessageVM as LessonAssignmentMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface LessonAssignmentMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: LessonAssignmentMessageType;
}

const difficultyConfig = {
  beginner: {
    label: 'Beginner',
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  intermediate: {
    label: 'Intermediate',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  advanced: {
    label: 'Advanced',
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
};

export function getAssignmentTypeLabel(kind?: 'homework' | 'lesson') {
  return kind === 'lesson' ? 'Lesson' : 'Homework';
}

export const LessonAssignmentMessage = memo(function LessonAssignmentMessage(
  props: LessonAssignmentMessageProps,
) {
  const { message, ...baseProps } = props;
  const { assignment } = message;
  const assignmentTypeLabel = getAssignmentTypeLabel(assignment.kind);
  const difficulty = assignment.difficulty
    ? difficultyConfig[assignment.difficulty]
    : null;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-primary/5">
      {message.content?.text && (
        <MessageTextContent text={message.content.text} className="mb-2" />
      )}
      <div className="rounded-xl border border-primary/20 bg-card overflow-hidden max-w-md">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {assignmentTypeLabel}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {assignment.title}
                </p>
              </div>
            </div>
            {difficulty && (
              <Badge variant="outline" className={cn('gap-1', difficulty.color)}>
                {difficulty.label}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-3">{assignment.description}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs mb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Due: {formatDate(assignment.dueAt)}</span>
            </div>
            {assignment.estimatedDuration && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(assignment.estimatedDuration)}</span>
              </div>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {assignment.subject}
            </Badge>
          </div>

          {assignment.attachments && assignment.attachments.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Attachments:
              </p>
              <div className="flex flex-col gap-2">
                {assignment.attachments.map((attachment, i) => (
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
        </div>

        <div className="px-4 py-3 bg-muted/50 border-t border-border">
          <Button size="sm" className="w-full">
            View Assignment
          </Button>
        </div>
      </div>
    </MessageBase>
  );
});
