import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import { DashboardHeader, Card, CardContent, Badge, Button } from '@iconicedu/ui-web';
import { Plus, ClipboardList } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin · Item Bank' };

const ITEM_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'MCQ',
  multiple_response: 'Multi-select',
  true_false: 'True/False',
  short_answer: 'Short answer',
  essay: 'Essay',
  ordering: 'Ordering',
  matching: 'Matching',
  gap_match: 'Fill-in-blank',
};

const DIFFICULTY_LABELS = ['', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

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
        description={`${total} question${total !== 1 ? 's' : ''}`}
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tag every question to a skill before adding it to a test.
          </p>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/admin/assessments/items/new`}>
              <Plus className="mr-2 h-4 w-4" /> New Question
            </Link>
          </Button>
        </div>

        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                No questions yet. Create your first question to build the item bank.
              </p>
              <Button asChild size="sm">
                <Link href={`/${orgSlug}/admin/assessments/items/new`}>
                  <Plus className="mr-2 h-4 w-4" /> New Question
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <Link key={item.id} href={`/${orgSlug}/admin/assessments/items/${item.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.skillName} · {item.domainName} · Grade {item.grade}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {ITEM_TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                      <div
                        className="flex gap-0.5"
                        title={`Difficulty: ${DIFFICULTY_LABELS[item.difficulty]}`}
                      >
                        {[1, 2, 3, 4, 5].map((d) => (
                          <div
                            key={d}
                            className={`h-1.5 w-1.5 rounded-full ${d <= item.difficulty ? 'bg-primary' : 'bg-muted'}`}
                          />
                        ))}
                      </div>
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
