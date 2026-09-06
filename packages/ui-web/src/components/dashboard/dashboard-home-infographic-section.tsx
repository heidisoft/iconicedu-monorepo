'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpenCheck,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Sparkle,
} from 'lucide-react';

import {
  ClassRequestAction,
  type ClassRequestRole as DashboardRequestRole,
  type ClassRequestableStudent as DashboardRequestableStudent,
} from '../class-request/class-request-action';
import { DashboardSessionsEmptyState } from '@iconicedu/ui-web/components/empty';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { SessionCard } from '@iconicedu/ui-web/components/messages/tabs/messages-session-card';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';
import type { ClassSession } from '@iconicedu/ui-web/components/messages/tabs/messages-schedule-tab.utils';
import { OTHER_SUBJECT_OPTION, STANDARD_SUBJECT_OPTIONS } from '@iconicedu/shared-types';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { SessionCompletedCarousel } from '@iconicedu/ui-web/components/dashboard/session-completed-carousel';

export interface DashboardUpcomingSessionListItem {
  session: ClassSession;
  channelId?: string | null;
  joinHref: string;
  chatHref: string;
  weekBucket: 'today' | 'this-week' | 'next-week';
}

export interface DashboardUpcomingSessionsSectionPage {
  items: DashboardUpcomingSessionListItem[];
  total: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardUpcomingSessionsPage {
  today: DashboardUpcomingSessionsSectionPage;
  thisWeek: DashboardUpcomingSessionsSectionPage;
  nextWeek: DashboardUpcomingSessionsSectionPage;
}

export interface DashboardHomeInfographicSectionProps {
  orgSlug: string;
  isStaffView?: boolean;
  isParentView?: boolean;
  isStudentView?: boolean;
  isTutorView?: boolean;
  topMetrics: {
    upcomingSessionsThisWeek: number;
    completedClassesThisMonth: number;
    activeSubjectsCount: number;
    activeSubjectsLabel: string;
  };
  upcomingSessionsPage: DashboardUpcomingSessionsPage;
  completedSessionsPending?: SessionCompletionVM[];
  sessionCompletionSummary?: {
    completed: number;
    pending: number;
  } | null;
  calendarHref: string;
  notificationsHref: string;
  browseHref: string;
  canRequestClasses?: boolean;
  requestRole?: DashboardRequestRole;
  requestableStudents?: DashboardRequestableStudent[];
  subjectOptions?: string[];
  onClassRequestCreated?: (channelId: string) => void;
  onJoinSession?: (item: DashboardUpcomingSessionListItem) => void | Promise<void>;
}

const DEFAULT_SUBJECT_OPTIONS = [...STANDARD_SUBJECT_OPTIONS, OTHER_SUBJECT_OPTION];

export function DashboardHomeInfographicSection({
  orgSlug,
  isStaffView = false,
  isParentView = false,
  isStudentView = false,
  isTutorView = false,
  topMetrics,
  upcomingSessionsPage,
  completedSessionsPending = [],
  sessionCompletionSummary = null,
  calendarHref,
  notificationsHref,
  browseHref,
  canRequestClasses = false,
  requestRole = 'other',
  requestableStudents = [],
  subjectOptions = DEFAULT_SUBJECT_OPTIONS,
  onClassRequestCreated,
  onJoinSession,
}: DashboardHomeInfographicSectionProps) {
  const quickActionIconClassName = 'size-5 shrink-0';
  const [currentPage, setCurrentPage] = useState(1);
  const { externalJoinTarget, closeExternalJoinDialog, handleResolvedJoinHref } =
    useExternalLiveSessionJoinDialog();
  const pageSize = Math.max(
    1,
    upcomingSessionsPage.today.pageSize,
    upcomingSessionsPage.thisWeek.pageSize,
    upcomingSessionsPage.nextWeek.pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    upcomingSessionsPage.today.items,
    upcomingSessionsPage.thisWeek.items,
    upcomingSessionsPage.nextWeek.items,
    pageSize,
  ]);

  const totalUpcomingSessions =
    upcomingSessionsPage.today.total +
    upcomingSessionsPage.thisWeek.total +
    upcomingSessionsPage.nextWeek.total;
  const totalPages = Math.max(1, Math.ceil(totalUpcomingSessions / pageSize));
  const visibleItems = useMemo(() => {
    const allItems = [
      ...upcomingSessionsPage.today.items,
      ...upcomingSessionsPage.thisWeek.items,
      ...upcomingSessionsPage.nextWeek.items,
    ];
    const startIndex = (currentPage - 1) * pageSize;
    return allItems.slice(startIndex, startIndex + pageSize);
  }, [
    upcomingSessionsPage.today.items,
    upcomingSessionsPage.thisWeek.items,
    upcomingSessionsPage.nextWeek.items,
    currentPage,
    pageSize,
  ]);
  const visibleSessionSections = [
    {
      key: 'today' as const,
      label: 'Today',
      items: visibleItems.filter((item) => item.weekBucket === 'today'),
      total: upcomingSessionsPage.today.total,
    },
    {
      key: 'this-week' as const,
      label: 'This week',
      items: visibleItems.filter((item) => item.weekBucket === 'this-week'),
      total: upcomingSessionsPage.thisWeek.total,
    },
    {
      key: 'next-week' as const,
      label: 'Next week',
      items: visibleItems.filter((item) => item.weekBucket === 'next-week'),
      total: upcomingSessionsPage.nextWeek.total,
    },
  ].filter((section) => section.items.length > 0);
  const activeNextWeekSessionCount = upcomingSessionsPage.nextWeek.items.filter(
    (item) => item.session.status !== 'cancelled',
  ).length;
  const upcomingSessionsMetric =
    topMetrics.upcomingSessionsThisWeek > 0
      ? {
          value: topMetrics.upcomingSessionsThisWeek,
          label: 'This week',
        }
      : {
          value: activeNextWeekSessionCount,
          label: 'Next week',
        };

  const openFamilySettings = () => {
    window.dispatchEvent(
      new CustomEvent('iconicedu:open-user-settings', {
        detail: { tab: 'family' },
      }),
    );
  };
  const openAccountSettings = () => {
    window.dispatchEvent(
      new CustomEvent('iconicedu:open-user-settings', {
        detail: { tab: 'account' },
      }),
    );
  };

  const infographicCardClassName =
    'relative overflow-hidden rounded-2xl border border-transparent p-5 shadow-soft';
  const infographicChipClassName = 'inline-flex rounded-xl bg-card p-2.5 shadow-soft';
  const infographicContentClassName = 'relative z-10';
  const shouldShowBoostLearningSection = isParentView || isStudentView;

  return (
    <section aria-label="Dashboard classroom sessions" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className={`${infographicCardClassName} bg-accent-periwinkle`}>
          <div className={infographicContentClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">Upcoming Sessions</p>
              <div
                className={`${infographicChipClassName} text-accent-periwinkle-foreground`}
              >
                <CalendarClock className="size-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
              {upcomingSessionsMetric.value}
            </p>
            <p className="mt-1 text-sm font-medium text-accent-periwinkle-foreground/80">
              {upcomingSessionsMetric.label}
            </p>
          </div>
        </article>

        <article
          className={`${infographicCardClassName} bg-primary-subtle`}
          aria-label="Session completion summary"
        >
          <div className={infographicContentClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">
                {sessionCompletionSummary ? 'Session Completion' : 'Completed Classes'}
              </p>
              <div className={`${infographicChipClassName} text-primary`}>
                <CalendarCheck className="size-5" aria-hidden="true" />
              </div>
            </div>
            {sessionCompletionSummary ? (
              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end">
                <div className="pr-4">
                  <p className="text-4xl font-semibold tracking-tight text-foreground">
                    {sessionCompletionSummary.completed}
                  </p>
                  <p className="mt-1 text-sm font-medium text-primary/80">
                    Sessions completed
                  </p>
                </div>
                <div className="border-l border-primary/15 pl-4">
                  <p className="text-xl font-semibold tracking-tight text-foreground">
                    {sessionCompletionSummary.pending}
                  </p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Pending completion
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                  {topMetrics.completedClassesThisMonth}
                </p>
                <p className="mt-1 text-sm font-medium text-primary/80">This month</p>
              </>
            )}
          </div>
        </article>

        <article className={`${infographicCardClassName} bg-accent-peach`}>
          <div className={infographicContentClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">
                {isStaffView
                  ? 'Manage Classrooms'
                  : isTutorView
                    ? 'Active Students'
                    : 'Active Subjects'}
              </p>
              <div className={`${infographicChipClassName} text-accent-peach-foreground`}>
                <BookOpenCheck className="size-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
              {topMetrics.activeSubjectsCount}
            </p>
            <p className="mt-1 text-sm font-medium text-accent-peach-foreground/80">
              {topMetrics.activeSubjectsLabel}
            </p>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-transparent bg-primary-subtle p-5 shadow-soft">
          <div className={infographicContentClassName}>
            <p className="text-base font-semibold text-foreground">
              {isParentView ? 'Manage my family' : 'Manage my account'}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {isParentView
                ? 'Update your children profiles and household links'
                : 'Update profile details, preferences, and account settings'}
            </p>
            {isParentView ? (
              <button
                type="button"
                onClick={openFamilySettings}
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Manage my family
              </button>
            ) : (
              <button
                type="button"
                onClick={openAccountSettings}
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Manage my account
              </button>
            )}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
        <article className="rounded-3xl border border-transparent bg-card p-6 shadow-soft">
          <SessionCompletedCarousel completions={completedSessionsPending} />

          <h2 className="mt-6 font-semibold tracking-tight">Upcoming Sessions</h2>

          <div className="mt-5 space-y-4">
            {totalUpcomingSessions > 0 ? (
              visibleSessionSections.map((section) => (
                <div key={section.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {section.label}
                    </p>
                  </div>
                  {section.items.map((item, index) => (
                    <SessionCard
                      key={item.session.id}
                      session={item.session}
                      index={index}
                      canJoin={item.weekBucket !== 'next-week'}
                      showJoinButton={item.weekBucket !== 'next-week'}
                      actionOrder="join-first"
                      classroomChatHref={item.chatHref}
                      joinLiveSession={
                        item.weekBucket !== 'next-week'
                          ? async () => {
                              if (onJoinSession) {
                                await onJoinSession(item);
                                return;
                              }
                              handleResolvedJoinHref(item.joinHref);
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              ))
            ) : (
              <DashboardSessionsEmptyState />
            )}
            {totalUpcomingSessions > pageSize ? (
              <div className="flex items-center justify-end gap-2 pt-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center justify-center rounded-md border border-border px-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:bg-transparent"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <span>{`Page ${currentPage} of ${totalPages}`}</span>
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center justify-center rounded-md border border-border px-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:bg-transparent"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </article>

        <aside className="rounded-3xl border border-transparent bg-card p-6 shadow-soft">
          <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Common tasks at your fingertips
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href={notificationsHref}
              className="flex min-h-36 flex-col rounded-2xl bg-primary p-5 text-primary-foreground transition hover:opacity-90"
            >
              <div className="flex items-start gap-2">
                <Bell className={quickActionIconClassName} aria-hidden="true" />
                <p className="min-w-0 flex-1 text-sm font-semibold leading-tight break-words">
                  Notifications
                </p>
              </div>
              <p className="mt-2 min-w-0 text-sm leading-snug text-primary-foreground/80 break-words">
                View recent updates
              </p>
            </a>

            <a
              href={calendarHref}
              className="flex min-h-36 flex-col rounded-2xl border border-border bg-background/70 p-5 transition hover:bg-muted/40"
            >
              <div className="flex items-start gap-2">
                <CalendarDays className={quickActionIconClassName} aria-hidden="true" />
                <p className="min-w-0 flex-1 text-sm font-semibold leading-tight break-words">
                  Calendar
                </p>
              </div>
              <p className="mt-2 min-w-0 text-sm leading-snug text-muted-foreground break-words">
                Review session schedule
              </p>
            </a>
          </div>

          {shouldShowBoostLearningSection ? (
            <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/20 p-2.5 text-primary">
                  <Sparkle className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold">Boost Your Learning!</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add more subjects or increase session frequency for better results.
                  </p>
                </div>
              </div>

              <ClassRequestAction
                orgSlug={orgSlug}
                fallbackHref={browseHref}
                canRequestClasses={canRequestClasses}
                requestRole={requestRole}
                requestableStudents={requestableStudents}
                subjectOptions={subjectOptions}
                onClassRequestCreated={onClassRequestCreated}
                renderTrigger={({
                  canRequestClasses: canRequest,
                  fallbackHref,
                  openDialog,
                }) =>
                  canRequest ? (
                    <button
                      type="button"
                      onClick={openDialog}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      <Sparkle className="mr-2 size-4" aria-hidden="true" />
                      Explore More Classes
                    </button>
                  ) : (
                    <a
                      href={fallbackHref}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      <Sparkle className="mr-2 size-4" aria-hidden="true" />
                      Explore More Classes
                    </a>
                  )
                }
              />
            </div>
          ) : null}
        </aside>
      </div>
      <ExternalLiveSessionJoinDialog
        target={externalJoinTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeExternalJoinDialog();
          }
        }}
      />
    </section>
  );
}
