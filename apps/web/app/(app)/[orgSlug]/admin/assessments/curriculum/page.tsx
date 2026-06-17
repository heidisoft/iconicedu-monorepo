import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import {
  DashboardHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
} from '@iconicedu/ui-web';
import { BookOpen, ChevronRight, Layers, Brain, ClipboardList } from 'lucide-react';
import { CreateSubjectForm } from '@iconicedu/web/components/assessments/create-subject-form';

export const metadata: Metadata = {
  title: 'Admin · Curriculum',
  description: 'Define subjects, domains, and skills before authoring questions.',
};

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const subjects = await api.listSubjects(org.id).catch(() => []);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Curriculum"
        description="Define subjects, domains, and skills. Every question must be tagged to a skill."
      />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {subjects.length > 0
              ? `${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`
              : 'No subjects yet'}
          </p>
          <CreateSubjectForm orgId={org.id} />
        </div>

        {subjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <BookOpen className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">No subjects yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Subjects organise your curriculum into domains and skills. Create your
                  first subject to get started.
                </p>
              </div>
              <CreateSubjectForm orgId={org.id} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Link
                key={subject.id}
                href={`/${orgSlug}/admin/assessments/curriculum/${subject.id}`}
              >
                <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full overflow-hidden group">
                  {/* Color accent stripe */}
                  {subject.color && (
                    <div
                      className="h-1 w-full"
                      style={{ backgroundColor: subject.color }}
                    />
                  )}
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl leading-none">
                          {subject.icon ?? '📚'}
                        </span>
                        <CardTitle className="text-base leading-snug">
                          {subject.name}
                        </CardTitle>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Layers className="h-2.5 w-2.5" />
                        {subject.domainCount ?? 0} domain
                        {subject.domainCount !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Brain className="h-2.5 w-2.5" />
                        {subject.skillCount ?? 0} skill
                        {subject.skillCount !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <ClipboardList className="h-2.5 w-2.5" />
                        {subject.itemCount ?? 0} question
                        {subject.itemCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
