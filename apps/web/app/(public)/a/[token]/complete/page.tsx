import { getPublicResult } from '@iconicedu/web/lib/assessments/api';
import { ResultsView } from '@iconicedu/web/components/assessments/results-view';
import Link from 'next/link';

export default async function PublicCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Assessment complete. Thank you!</p>
      </div>
    );
  }

  const result = await getPublicResult(sessionId).catch(() => null);

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Assessment Complete!</h1>
          <p className="text-muted-foreground mt-1">
            Here are your results and personalised learning plan.
          </p>
        </div>

        {result ? (
          <ResultsView result={result} showAllReports={false} />
        ) : (
          <p className="text-center text-muted-foreground">
            Results are being processed. Check back shortly.
          </p>
        )}

        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            Want to track your progress over time?
          </p>
          <Link
            href="/sign-up"
            className="text-primary underline-offset-4 hover:underline text-sm font-medium"
          >
            Create a free account →
          </Link>
        </div>
      </div>
    </div>
  );
}
