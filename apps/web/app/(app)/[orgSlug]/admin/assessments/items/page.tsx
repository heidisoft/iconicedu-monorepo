import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Button } from '@iconicedu/ui-web';
import { Plus, ClipboardList, ChevronRight } from 'lucide-react';
import { ItemBankFilters } from '@iconicedu/web/components/assessments/item-bank-filters';
import { ListPagination } from '@iconicedu/web/components/assessments/list-pagination';

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
    subjectIds?: string;
    grades?: string;
    types?: string;
    difficulties?: string;
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
  function parseParam(v?: string): string[] {
    return v ? v.split(',').filter(Boolean) : [];
  }

  const subjectIds = parseParam(filters.subjectIds);
  const grades = parseParam(filters.grades).map(Number);
  const types = parseParam(filters.types);
  const difficulties = parseParam(filters.difficulties).map(Number);

  const [{ items, total }, subjects] = await Promise.all([
    api
      .listItems(org.id, {
        skillId: filters.skillId,
        subjectIds: subjectIds.length ? subjectIds : undefined,
        grades: grades.length ? grades : undefined,
        types: types.length ? types : undefined,
        difficulties: difficulties.length ? difficulties : undefined,
        search: filters.search,
        page: filters.page ? Number(filters.page) : 1,
      })
      .catch(() => ({ items: [], total: 0 })),
    api.listSubjects(org.id).catch(() => []),
  ]);

  const hasActiveFilters = !!(
    filters.skillId ||
    subjectIds.length ||
    grades.length ||
    types.length ||
    difficulties.length ||
    filters.search
  );

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Item Bank" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        {/* Page title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Item Bank</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Questions tagged to skills and difficulty levels, ready to be assembled into
              tests.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/items/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Question
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <ItemBankFilters subjects={subjects} />

        {/* List */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ClipboardList className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              {hasActiveFilters ? (
                <>
                  <p className="text-sm font-medium">No questions match your filters</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Try adjusting or clearing the filters above.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No questions yet</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Every question is tagged to a skill and difficulty level. Build your
                    item bank before creating a test.
                  </p>
                </>
              )}
            </div>
            {!hasActiveFilters && (
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/items/new`}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Question
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
                <h2 className="text-sm font-semibold">Questions ({total})</h2>
              </div>
              <div className="divide-y">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${orgSlug}/admin/assessments/items/${item.id}`}
                    className="group flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Type pill */}
                    <span
                      className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-medium ${ITEM_TYPE_COLORS[item.type] ?? 'bg-muted text-muted-foreground border-border'}`}
                    >
                      {ITEM_TYPE_LABELS[item.type] ?? item.type}
                    </span>

                    {/* Question title + breadcrumb */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[
                          item.skillName,
                          item.domainName,
                          item.grade ? `Grade ${item.grade}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>

                    {/* Difficulty */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="flex gap-0.5"
                        title={`Difficulty: ${DIFFICULTY_LABELS[item.difficulty]}`}
                      >
                        {[1, 2, 3, 4, 5].map((d) => (
                          <div
                            key={d}
                            className={`h-2 w-2 rounded-full ${d <= item.difficulty ? 'bg-primary' : 'bg-muted'}`}
                          />
                        ))}
                      </div>
                      <span
                        className={`text-xs font-medium hidden sm:block ${DIFFICULTY_COLORS[item.difficulty] ?? ''}`}
                      >
                        {DIFFICULTY_LABELS[item.difficulty] ?? ''}
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </div>
            <ListPagination total={total} pageSize={20} />
          </div>
        )}
      </div>
    </div>
  );
}
