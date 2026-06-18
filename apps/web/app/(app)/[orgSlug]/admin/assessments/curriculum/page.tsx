import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Button } from '@iconicedu/ui-web';
import { BookOpen, Layers, Brain, ClipboardList } from 'lucide-react';
import { CreateSubjectForm } from '@iconicedu/web/components/assessments/create-subject-form';
import { ListFilters } from '@iconicedu/web/components/assessments/list-filters';

export const metadata: Metadata = {
  title: 'Admin · Curriculum',
  description: 'Define subjects, domains, and skills before authoring questions.',
};

export default async function CurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const { orgSlug } = await params;
  const filters = await searchParams;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const subjects = await api.listSubjects(org.id, filters.search).catch(() => []);

  const hasActiveFilters = !!filters.search;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Curriculum" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        {/* Page title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Curriculum</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Define subjects, domains, and skills. Every question must be tagged to a
              skill.
            </p>
          </div>
          <CreateSubjectForm orgId={org.id} />
        </div>

        {/* Filters — only search, no extra categorical filters needed for subjects */}
        <ListFilters searchPlaceholder="Search subjects…" />

        {/* Subject list */}
        {subjects.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              {hasActiveFilters ? (
                <>
                  <p className="text-sm font-medium">No subjects match your search</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Try a different search term or clear the filter above.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No subjects yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Subjects organise your curriculum into domains and skills. Create your
                    first subject to get started.
                  </p>
                </>
              )}
            </div>
            {!hasActiveFilters && <CreateSubjectForm orgId={org.id} />}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
              <h2 className="text-sm font-semibold">Subjects ({subjects.length})</h2>
            </div>

            <div className="divide-y">
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center gap-4 px-6 py-5">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{
                      backgroundColor: subject.color ? `${subject.color}20` : undefined,
                    }}
                  >
                    {subject.icon ?? '📚'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/${orgSlug}/admin/assessments/curriculum/${subject.id}`}
                      className="text-sm font-semibold hover:underline underline-offset-2"
                    >
                      {subject.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Layers className="h-3 w-3" />
                        {subject.domainCount ?? 0} domain
                        {subject.domainCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Brain className="h-3 w-3" />
                        {subject.skillCount ?? 0} skill
                        {subject.skillCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ClipboardList className="h-3 w-3" />
                        {subject.itemCount ?? 0} question
                        {subject.itemCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {subject.color && (
                    <div
                      className="hidden sm:block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: subject.color }}
                    />
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <CreateSubjectForm orgId={org.id} subject={subject} />
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/${orgSlug}/admin/assessments/curriculum/${subject.id}`}
                      >
                        Domains & Skills
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
