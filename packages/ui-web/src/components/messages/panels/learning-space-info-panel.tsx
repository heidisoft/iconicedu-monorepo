'use client';

import { memo } from 'react';
import type { CSSProperties } from 'react';
import {
  ClipboardCheck,
  FileText,
  Folder,
  GraduationCap,
  Link2,
  LogOut,
  MoreHorizontal,
  Sparkles,
  Video,
  Bookmark,
  Flag,
  MessageCircle,
} from 'lucide-react';
import type { LearningSpaceVM, MessagesRightPanelIntent } from '@iconicedu/shared-types';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import { ButtonGroup } from '@iconicedu/ui-web/ui/button-group';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { MediaFilesPanel } from '@iconicedu/ui-web/components/messages/shared/media-files-panel';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { formatEventTime } from '@iconicedu/ui-web/lib/class-schedule-utils';
import { useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';

interface LearningSpaceInfoPanelProps {
  intent: MessagesRightPanelIntent;
  learningSpace?: LearningSpaceVM | null;
}

const ActionButton = memo(function ActionButton({
  icon: Icon,
  label,
  href,
  isInactive,
  themeKey,
}: {
  icon: typeof Link2;
  label: string;
  href?: string | null;
  isInactive?: boolean;
  themeKey?: string | null;
}) {
  const themeClass = themeKey ? `theme-${themeKey}` : '';
  const themeHoverStyle = themeKey
    ? ({
        ['--theme-hover' as string]:
          'color-mix(in oklab, var(--theme-bg) 18%, transparent)',
      } as CSSProperties)
    : undefined;
  const content = (
    <>
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors',
          themeKey
            ? `${themeClass} group-hover:bg-[var(--theme-hover)] group-hover:text-[var(--theme-bg)]`
            : 'group-hover:bg-primary/15 group-hover:text-primary',
        )}
        style={themeHoverStyle}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="w-full truncate text-center">{label}</span>
    </>
  );

  if (href && !isInactive) {
    return (
      <Button
        asChild
        variant="ghost"
        className="group h-auto w-16 shrink-0 basis-16 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-transparent"
      >
        <a href={href}>{content}</a>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      className="group h-auto w-16 shrink-0 basis-16 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-transparent"
      disabled={isInactive}
    >
      {content}
    </Button>
  );
});

const LEARNING_SPACE_LINK_ICONS: Record<string, typeof Link2> = {
  video: Video,
  'graduation-cap': GraduationCap,
  folder: Folder,
};

const LearningSpaceInfoPanelContent = memo(function LearningSpaceInfoPanelContent({
  learningSpace,
}: {
  learningSpace: LearningSpaceVM;
}) {
  const { channel, toggle, messageFilter, toggleMessageFilter, currentUserId } =
    useMessagesState();
  const isMobile = useIsMobile();
  const themeKey = channel.ui?.themeKey ?? null;
  const infoPanel = channel.ui?.infoPanel;
  const showMembers = infoPanel?.showMembers ?? true;
  const themeHoverClass = themeKey
    ? `theme-${themeKey} group-hover:bg-[var(--theme-hover)] group-hover:text-[var(--theme-bg)]`
    : 'group-hover:bg-primary/15 group-hover:text-primary';
  const themeHoverStyle = themeKey
    ? ({
        ['--theme-hover' as string]:
          'color-mix(in oklab, var(--theme-bg) 18%, transparent)',
      } as CSSProperties)
    : undefined;

  const iconKey = learningSpace.basics.iconKey ?? channel.basics.iconKey ?? 'sparkles';
  const Icon = getLearningSpaceIcon(iconKey);
  const schedule = learningSpace.schedule?.scheduleSeries ?? null;
  const quickLinks = learningSpace.resources?.links ?? [];
  const visibleLinks = quickLinks.filter((link) => !link.hidden);
  const maxVisibleLinks = isMobile ? 1 : 2;
  const primaryLinks = visibleLinks.slice(0, maxVisibleLinks);
  const overflowLinks = visibleLinks.slice(maxVisibleLinks);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-col items-center gap-3 p-6 min-w-0 text-center">
        <ThemedIconBadge icon={Icon} themeKey={channel.ui?.themeKey ?? null} size="lg" />
        <div className="text-center min-w-0">
          <h2 className="text-lg font-semibold text-foreground break-words">
            {learningSpace.basics.title}
          </h2>
          {learningSpace.basics.description ? (
            <p className="mt-1 text-sm text-muted-foreground break-words">
              {learningSpace.basics.description}
            </p>
          ) : null}
        </div>
        {learningSpace.basics.kind ? (
          <Badge variant="secondary" className="text-xs">
            {learningSpace.basics.kind.replace(/_/g, ' ')}
          </Badge>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-4 p-4 min-w-0">
        <h3 className="text-sm font-semibold text-foreground text-center">
          Quick Actions
        </h3>
        <ButtonGroup className="mx-auto flex-nowrap justify-center overflow-hidden">
          {primaryLinks.map((link) => {
            const icon = link.iconKey
              ? (LEARNING_SPACE_LINK_ICONS[link.iconKey] ?? Link2)
              : Link2;
            return (
              <ActionButton
                key={link.label}
                icon={icon}
                label={link.label}
                href={link.url}
                isInactive={link.status === 'inactive'}
                themeKey={themeKey}
              />
            );
          })}
          <Button
            variant="ghost"
            className="group h-auto w-16 shrink-0 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-transparent"
            onClick={() => toggleMessageFilter('homework')}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors',
                themeKey
                  ? `theme-${themeKey} group-hover:bg-[var(--theme-hover)] group-hover:text-[var(--theme-bg)]`
                  : 'group-hover:bg-primary/15 group-hover:text-primary',
              )}
              style={
                themeKey
                  ? ({
                      ['--theme-hover' as string]:
                        'color-mix(in oklab, var(--theme-bg) 18%, transparent)',
                    } as CSSProperties)
                  : undefined
              }
            >
              <ClipboardCheck
                className={messageFilter === 'homework' ? 'text-primary' : undefined}
              />
            </span>
            <span
              className={messageFilter === 'homework' ? 'text-foreground' : undefined}
            >
              <span className="w-full truncate text-center">Homework</span>
            </span>
          </Button>
          <Button
            variant="ghost"
            className="group h-auto w-16 shrink-0 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-transparent"
            onClick={() => toggleMessageFilter('session-summary')}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors',
                themeKey
                  ? `theme-${themeKey} group-hover:bg-[var(--theme-hover)] group-hover:text-[var(--theme-bg)]`
                  : 'group-hover:bg-primary/15 group-hover:text-primary',
              )}
              style={
                themeKey
                  ? ({
                      ['--theme-hover' as string]:
                        'color-mix(in oklab, var(--theme-bg) 18%, transparent)',
                    } as CSSProperties)
                  : undefined
              }
            >
              <FileText
                className={
                  messageFilter === 'session-summary' ? 'text-primary' : undefined
                }
              />
            </span>
            <span
              className={
                messageFilter === 'session-summary' ? 'text-foreground' : undefined
              }
            >
              <span className="w-full truncate text-center">Summary</span>
            </span>
          </Button>
          <Button
            variant="ghost"
            className="group h-auto w-16 shrink-0 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-transparent"
            onClick={() => toggle({ key: 'saved' })}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors',
                themeHoverClass,
              )}
              style={themeHoverStyle}
            >
              <Bookmark className="h-4 w-4" />
            </span>
            <span className="w-full truncate text-center">Saved</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="group h-auto w-16 shrink-0 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-transparent"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors',
                    themeHoverClass,
                  )}
                  style={themeHoverStyle}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </span>
                <span className="w-full truncate text-center">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {overflowLinks.map((link) => {
                const linkIconKey = link.iconKey ?? undefined;
                const LinkIcon = linkIconKey
                  ? (LEARNING_SPACE_LINK_ICONS[linkIconKey] ?? Link2)
                  : Link2;
                if (link.url && link.status !== 'inactive') {
                  return (
                    <DropdownMenuItem key={link.label} asChild>
                      <a href={link.url} className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{link.label}</span>
                      </a>
                    </DropdownMenuItem>
                  );
                }
                return (
                  <DropdownMenuItem key={link.label} disabled>
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{link.label}</span>
                  </DropdownMenuItem>
                );
              })}
              {overflowLinks.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem>
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span>Leave</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Flag className="h-4 w-4 text-muted-foreground" />
                <span>Report</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>

      <Separator />

      <div className="space-y-4 p-4 min-w-0">
        <h3 className="text-sm font-semibold text-foreground text-center">Next Up</h3>
        {schedule ? (
          (() => {
            const scheduleDate = new Date(schedule.startAt);
            const getDateLabel = (date: Date) =>
              date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
            const getWeekday = (date: Date) =>
              date.toLocaleDateString('en-US', { weekday: 'short' });
            const getMonth = (date: Date) =>
              date.toLocaleDateString('en-US', { month: 'short' });
            const dateParam = [
              scheduleDate.getFullYear(),
              String(scheduleDate.getMonth() + 1).padStart(2, '0'),
              String(scheduleDate.getDate()).padStart(2, '0'),
            ].join('-');
            const calendarUrl = `/d/class-schedule?view=day&date=${dateParam}`;

            const shiftDate = (date: Date, offset: number) => {
              const next = new Date(date);
              const frequency = schedule.recurrence?.rule.frequency ?? 'daily';
              if (frequency === 'weekly') {
                next.setDate(next.getDate() + offset * 7);
              } else if (frequency === 'monthly') {
                next.setMonth(next.getMonth() + offset);
              } else if (frequency === 'yearly') {
                next.setFullYear(next.getFullYear() + offset);
              } else {
                next.setDate(next.getDate() + offset);
              }
              return next;
            };

            const dates = [
              shiftDate(scheduleDate, -1),
              scheduleDate,
              shiftDate(scheduleDate, 1),
            ];

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <a
                    href={calendarUrl}
                    className="relative flex h-[86px] w-full max-w-[300px] items-center justify-center"
                    aria-label={`Open schedule for ${getDateLabel(scheduleDate)}`}
                  >
                    <div className="absolute left-2 top-1/2 z-0 w-[92px] -translate-y-1/2 rounded-2xl border bg-muted/20 px-2.5 py-1.5 text-center text-muted-foreground">
                      <div className="text-[10px] font-semibold uppercase">Previous</div>
                      <div className="text-base font-semibold">{dates[0].getDate()}</div>
                      <div className="text-[10px] uppercase">{getMonth(dates[0])}</div>
                    </div>
                    <div className="absolute right-2 top-1/2 z-0 w-[92px] -translate-y-1/2 rounded-2xl border bg-muted/20 px-2.5 py-1.5 text-center text-muted-foreground">
                      <div className="text-[10px] font-semibold uppercase">Next</div>
                      <div className="text-base font-semibold">{dates[2].getDate()}</div>
                      <div className="text-[10px] uppercase">{getMonth(dates[2])}</div>
                    </div>
                    <div className="relative z-10 w-[150px] rounded-2xl border bg-muted px-3 py-2 text-center">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {getWeekday(dates[1])}
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        {dates[1].getDate()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getMonth(dates[1])}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatEventTime(schedule.startAt)} -{' '}
                        {formatEventTime(schedule.endAt)}
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="text-sm text-muted-foreground text-center">
            No upcoming session.
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4 p-4 min-w-0">
        <MediaFilesPanel
          media={channel.collections.media.items}
          files={channel.collections.files.items}
        />
      </div>

      {showMembers ? (
        <>
          <Separator />

          <div className="space-y-4 p-4 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Members</h3>
            <div className="space-y-3 min-w-0">
              {learningSpace.participants.map((member) => {
                const memberName = getProfileDisplayName(member.profile);
                const dmTargetId =
                  currentUserId && member.ids.id !== currentUserId ? member.ids.id : null;

                return (
                  <div key={member.ids.id} className="flex items-center gap-3">
                    <AvatarWithStatus
                      name={memberName}
                      avatar={member.profile.avatar}
                      themeKey={member.ui?.themeKey}
                      sizeClassName="h-9 w-9"
                      initialsLength={1}
                      presence={member.presence}
                      showStatus={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {memberName}
                      </div>
                      {member.presence?.state?.emoji || member.presence?.state?.text ? (
                        <div className="truncate text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {member.presence?.state?.emoji ? (
                              <span>{member.presence.state.emoji}</span>
                            ) : null}
                            {member.presence?.state?.text ? (
                              <span className="truncate">
                                {member.presence.state.text}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {dmTargetId ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-primary/15 hover:text-primary"
                        aria-label={`Message ${memberName}`}
                      >
                        <a href={`/d/dm/${dmTargetId}`}>
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              {learningSpace.participants.length === 0 ? (
                <div className="text-sm text-muted-foreground">No members added yet.</div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
});

export function LearningSpaceInfoPanel({
  intent,
  learningSpace,
}: LearningSpaceInfoPanelProps) {
  if (!learningSpace) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <LearningSpaceInfoPanelContent learningSpace={learningSpace} />
    </div>
  );
}
