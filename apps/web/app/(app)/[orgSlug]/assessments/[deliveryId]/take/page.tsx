'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type { AssessmentSessionVM, AssessmentNextItemVM } from '@iconicedu/shared-types';
import { QuestionPlayer } from '@iconicedu/web/components/assessments/question-player';

export default function TakeAssessmentPage() {
  const { orgSlug, deliveryId } = useParams<{ orgSlug: string; deliveryId: string }>();
  const [session, setSession] = useState<AssessmentSessionVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = createAssessmentApiClient(createSupabaseBrowserClient());
    api
      .startSession({ deliveryId })
      .then((s) => setSession(s))
      .catch(() => setError('Could not start the session. Please go back and try again.'))
      .finally(() => setLoading(false));
  }, [deliveryId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading assessment…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <p className="text-destructive">{error || 'Session could not be loaded.'}</p>
      </div>
    );
  }

  const currentItem = session.currentItem;
  if (!currentItem) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <p className="text-muted-foreground">No questions available.</p>
      </div>
    );
  }

  const initialState: AssessmentNextItemVM = {
    nextItem: currentItem,
    isComplete: false,
    sessionStatus: session.status,
    itemsAnswered: 0,
    itemsTotal: session.totalItems ?? null,
  };

  const api = createAssessmentApiClient(createSupabaseBrowserClient());

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <QuestionPlayer
          sessionId={session.id}
          initialItem={currentItem}
          initialState={initialState}
          onSaveResponse={(sid, body) => api.saveResponse(sid, body)}
          onSubmit={(sid) => api.submitSession(sid).then(() => undefined)}
          redirectOnComplete={`/${orgSlug}/assessments/${deliveryId}/results`}
        />
      </div>
    </div>
  );
}
