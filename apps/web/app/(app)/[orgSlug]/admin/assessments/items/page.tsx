import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Card, CardContent, Badge, Button } from '@iconicedu/ui-web';
import { Plus, ClipboardList, ChevronRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin · Item Bank' };

const ITEM_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'MCQ',
  multiple_response: 'Multi-select',
  true_false: 'True / False',
  short_answer: 'Short answer',
  essay: 'Essay',
  ordering: 'Ordering',
  matching: 'Matching',
  gap_match: 'Fill-in-blank',
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  multiple_choice:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  multiple_response:
    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  true_false:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  short_answer:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  essay:
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  ordering:
    'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800',
  matching:
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
  gap_match:
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
};

const DIFFICULTY_LABELS = ['', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const DIFFICULTY_COLORS = [
  '',
  'text-emerald-600',
  'text-green-600',
  'text-amber-600',
  'text-orange-600',
  'text-red-600',
];

export default async function ItemBankPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    skillId?: string;
    type?: string;
    difficulty?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const { orgSlug } = await params;
  const filters = await searchParams;
  const { supabase } = await getDashboardAccountContext(orgSlug);
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const api = createAssessmentApiClient(supabase);
  const { items, total } = await api
    .listItems(org.id, {
      skillId: filters.skillId,
      type: filters.type,
      difficulty: filters.difficulty ? Number(filters.difficulty) : undefined,
      search: filters.search,
      page: filters.page ? Number(filters.page) : 1,
    })
    .catch(() => ({ items: [], total: 0 }));

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Item Bank"
        description="Questions tagged to skills, ready to be assembled into tests."
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} question{total !== 1 ? 's' : ''}
          </p>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/items/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Question
            </Link>
          </Button>
        </div>

        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">No questions yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Every question is tagged to a skill and difficulty level. Build your
                  item bank before creating a test.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/items/new`}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Question
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <Link key={item.id} href={`/${orgSlug}/admin/assessments/items/${item.id}`}>
                <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer group">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    {/* Type badge */}
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium shrink-0 ${ITEM_TYPE_COLORS[item.type] ?? 'bg-muted text-muted-foreground border-border'}`}
                    >
                      {ITEM_TYPE_LABELS[item.type] ?? item.type}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.skillName}
                        {item.domainName ? ` · ${item.domainName}` : ''}
                        {item.grade ? ` · Grade ${item.grade}` : ''}
                      </p>
                    </div>

                    {/* Difficulty */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div
                        className="flex gap-0.5"
                        title={`Difficulty: ${DIFFICULTY_LABELS[item.difficulty]}`}
                      >
                        {[1, 2, 3, 4, 5].map((d) => (
                          <div
                            key={d}
                            className={`h-2 w-2 rounded-full transition-colors ${d <= item.difficulty ? 'bg-primary' : 'bg-muted'}`}
                          />
                        ))}
                      </div>
                      <span
                        className={`text-xs font-medium ${DIFFICULTY_COLORS[item.difficulty] ?? ''}`}
                      >
                        {DIFFICULTY_LABELS[item.difficulty] ?? ''}
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
