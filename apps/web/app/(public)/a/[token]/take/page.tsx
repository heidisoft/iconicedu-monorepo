'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type {
  AssessmentSessionVM,
  AssessmentNextItemVM,
  AssessmentItemVM,
} from '@iconicedu/shared-types';
import {
  savePublicResponse,
  submitPublicSession,
} from '@iconicedu/web/lib/assessments/api';
import { QuestionPlayer } from '@iconicedu/web/components/assessments/question-player';

export default function PublicTakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('s');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // We need the session data — in public mode the session has the first item
  const [session, setSession] = useState<AssessmentSessionVM | null>(null);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!sessionId) {
      setError('Session not found. Please go back and start again.');
      setLoading(false);
      return;
    }
    // Fetch session from API (public endpoint, no auth)
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(
      /\/+$/,
      '',
    );
    fetch(`${apiUrl}/assessment-sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AssessmentSessionVM | null) => {
        if (!data) {
          setError('Session not found.');
        } else {
          setSession(data);
        }
      })
      .catch(() => setError('Failed to load session.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <LoadingScreen />;
  if (error || !session || !sessionId) return <ErrorScreen message={error} />;

  const currentItem = session.currentItem;
  if (!currentItem) return <ErrorScreen message="No questions available." />;

  const initialState: AssessmentNextItemVM = {
    nextItem: currentItem,
    isComplete: false,
    sessionStatus: session.status,
    itemsAnswered: 0,
    itemsTotal: null,
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <QuestionPlayer
          sessionId={sessionId}
          initialItem={currentItem}
          initialState={initialState}
          onSaveResponse={async (sid, body) => {
            return await savePublicResponse(sid, body);
          }}
          onSubmit={submitPublicSession}
          redirectOnComplete={`/a/${token ?? ''}/complete?s=${sessionId}`}
        />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-destructive font-medium">
          {message || 'Something went wrong.'}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Please go back and try again.
        </p>
      </div>
    </div>
  );
}
