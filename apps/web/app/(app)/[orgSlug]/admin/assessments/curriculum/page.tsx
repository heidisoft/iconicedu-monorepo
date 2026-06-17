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
  Badge,
  Button,
} from '@iconicedu/ui-web';
import { BookOpen, ChevronRight, Plus } from 'lucide-react';
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
            {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </p>
          <CreateSubjectForm orgId={org.id} />
        </div>

        {subjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                No subjects yet. Create your first subject to start defining the
                curriculum.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Link
                key={subject.id}
                href={`/${orgSlug}/admin/assessments/curriculum/${subject.id}`}
              >
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{subject.icon ?? '📚'}</span>
                      <CardTitle className="text-base">{subject.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{subject.domainCount ?? 0} domains</span>
                      <span>•</span>
                      <span>{subject.skillCount ?? 0} skills</span>
                      <span>•</span>
                      <span>{subject.itemCount ?? 0} questions</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {subject.color && (
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: subject.color }}
                        />
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
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
