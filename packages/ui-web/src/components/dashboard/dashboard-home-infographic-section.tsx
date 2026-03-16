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

// eslint-disable-next-line no-restricted-imports
import {
  ClassRequestAction,
  type ClassRequestRole as DashboardRequestRole,
  type ClassRequestableStudent as DashboardRequestableStudent,
} from '../class-request/class-request-action';
import { DashboardSessionsEmptyState } from '@iconicedu/ui-web/components/empty';
import { SessionCard } from '@iconicedu/ui-web/components/messages/tabs/messages-session-card';
import type { ClassSession } from '@iconicedu/ui-web/components/messages/tabs/messages-schedule-tab.utils';
import { DotPattern } from '@iconicedu/ui-web/ui/dot-pattern';
import { OTHER_SUBJECT_OPTION, STANDARD_SUBJECT_OPTIONS } from '@iconicedu/shared-types';

export interface DashboardUpcomingSessionListItem {
  session: ClassSession;
  joinHref: string;
  chatHref: string;
  weekBucket: 'this-week' | 'next-week';
}

export interface DashboardUpcomingSessionsSectionPage {
  items: DashboardUpcomingSessionListItem[];
  total: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardUpcomingSessionsPage {
  thisWeek: DashboardUpcomingSessionsSectionPage;
  nextWeek: DashboardUpcomingSessionsSectionPage;
}

export interface DashboardHomeInfographicSectionProps {
  orgSlug: string;
  isStaffView?: boolean;
  isParentView?: boolean;
  topMetrics: {
    upcomingSessionsThisWeek: number;
    completedClassesThisMonth: number;
    activeSubjectsCount: number;
    activeSubjectsLabel: string;
  };
  upcomingSessionsPage: DashboardUpcomingSessionsPage;
  calendarHref: string;
  notificationsHref: string;
  browseHref: string;
  canRequestClasses?: boolean;
  requestRole?: DashboardRequestRole;
  requestableStudents?: DashboardRequestableStudent[];
  subjectOptions?: string[];
  onClassRequestCreated?: (channelId: string) => void;
  onJoinSession?: (joinHref: string) => void | Promise<void>;
}

const DEFAULT_SUBJECT_OPTIONS = [...STANDARD_SUBJECT_OPTIONS, OTHER_SUBJECT_OPTION];

export function DashboardHomeInfographicSection({
  orgSlug,
  isStaffView = false,
  isParentView = false,
  topMetrics,
  upcomingSessionsPage,
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
  const pageSize = Math.max(
    1,
    upcomingSessionsPage.thisWeek.pageSize,
    upcomingSessionsPage.nextWeek.pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    upcomingSessionsPage.thisWeek.items,
    upcomingSessionsPage.nextWeek.items,
    pageSize,
  ]);

  const totalUpcomingSessions =
    upcomingSessionsPage.thisWeek.total + upcomingSessionsPage.nextWeek.total;
  const totalPages = Math.max(1, Math.ceil(totalUpcomingSessions / pageSize));
  const visibleItems = useMemo(() => {
    const allItems = [
      ...upcomingSessionsPage.thisWeek.items,
      ...upcomingSessionsPage.nextWeek.items,
    ];
    const startIndex = (currentPage - 1) * pageSize;
    return allItems.slice(startIndex, startIndex + pageSize);
  }, [
    upcomingSessionsPage.thisWeek.items,
    upcomingSessionsPage.nextWeek.items,
    currentPage,
    pageSize,
  ]);
  const visibleSessionSections = [
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
    'relative overflow-hidden rounded-2xl border border-border bg-card p-5';
  const infographicContentClassName = 'relative z-10';
  const infographicPatternClassName =
    'text-primary/20 [mask-image:radial-gradient(250px_circle_at_center,black,transparent_78%)]';

  return (
    <section aria-label="Dashboard classroom sessions" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className={infographicCardClassName}>
          <DotPattern
            width={20}
            height={20}
            cr={3.5}
            glow={true}
            className={infographicPatternClassName}
          />
          <div className={infographicContentClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">Upcoming Sessions</p>
              <div className="inline-flex rounded-xl bg-primary/15 p-2.5 text-primary/80">
                <CalendarClock className="size-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-tight">
              {topMetrics.upcomingSessionsThisWeek}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">This week</p>
          </div>
        </article>

        <article className={infographicCardClassName}>
          <DotPattern
            width={20}
            height={20}
            cr={3.5}
            glow={true}
            className={`${infographicPatternClassName} text-emerald-500/20`}
          />
          <div className={infographicContentClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">Completed Classes</p>
              <div className="inline-flex rounded-xl bg-primary/15 p-2.5 text-primary/80">
                <CalendarCheck className="size-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-tight">
              {topMetrics.completedClassesThisMonth}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">This month</p>
          </div>
        </article>

        <article className={infographicCardClassName}>
          <DotPattern
            width={20}
            height={20}
            cr={3.5}
            glow={true}
            className={`${infographicPatternClassName} text-sky-500/20`}
          />
          <div className={infographicContentClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">
                {isStaffView ? 'Manage Classrooms' : 'Active Subjects'}
              </p>
              <div className="inline-flex rounded-xl bg-primary/15 p-2.5 text-primary/80">
                <BookOpenCheck className="size-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-tight">
              {topMetrics.activeSubjectsCount}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {topMetrics.activeSubjectsLabel}
            </p>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-border bg-primary/10 p-5">
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
        <article className="rounded-3xl border border-border bg-card/80 p-6">
          <h2 className="font-semibold tracking-tight">Upcoming Sessions</h2>

          <div className="mt-5 space-y-3">
            {totalUpcomingSessions > 0 ? (
              visibleSessionSections.map((section) => (
                <div key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {section.label}
                    </p>
                  </div>
                  {section.items.map(
                    ({ session, joinHref, chatHref, weekBucket }, index) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        index={index}
                        canJoin={weekBucket === 'this-week'}
                        showJoinButton={weekBucket === 'this-week'}
                        actionOrder="join-first"
                        classroomChatHref={chatHref}
                        joinLiveSession={
                          weekBucket === 'this-week'
                            ? async () => {
                                if (onJoinSession) {
                                  await onJoinSession(joinHref);
                                  return;
                                }
                                window.location.assign(joinHref);
                              }
                            : undefined
                        }
                      />
                    ),
                  )}
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

        <aside className="rounded-3xl border border-border bg-card/80 p-6">
          <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Common tasks at your fingertips
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a
              href={notificationsHref}
              className="rounded-2xl bg-primary p-5 text-primary-foreground transition hover:opacity-90"
            >
              <div className="flex items-center gap-2">
                <Bell className={quickActionIconClassName} aria-hidden="true" />
                <p className="text-sm font-semibold leading-tight">Notifications</p>
              </div>
              <p className="mt-1 text-sm text-primary-foreground/80">
                View recent updates
              </p>
            </a>

            <a
              href={calendarHref}
              className="rounded-2xl border border-border bg-background/70 p-5 transition hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <CalendarDays className={quickActionIconClassName} aria-hidden="true" />
                <p className="text-sm font-semibold leading-tight">Calendar</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Review session schedule
              </p>
            </a>
          </div>

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
        </aside>
      </div>
    </section>
  );
}
