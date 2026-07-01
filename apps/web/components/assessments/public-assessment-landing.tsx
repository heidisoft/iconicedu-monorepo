'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AssessmentDeliveryVM } from '@iconicedu/shared-types';
import { startPublicSession } from '@iconicedu/web/lib/assessments/api';
import { Button, Card, CardContent, Input, Label, Badge } from '@iconicedu/ui-web';
import { Clock, ChevronRight } from 'lucide-react';

interface Props {
  delivery: AssessmentDeliveryVM;
  token: string;
}

export function PublicAssessmentLanding({ delivery, token }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function handleStart() {
    if (delivery.collectNameEmail && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const session = await startPublicSession({
        deliveryId: delivery.id,
        accessToken: token,
        anonName: name || undefined,
        anonEmail: email || undefined,
      });
      if (!session) {
        setError('Could not start the session. Please try again.');
        return;
      }
      router.push(`/a/${token}/take?s=${session.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg flex flex-col gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold">{delivery.title}</h1>
          <p className="text-muted-foreground mt-1">{delivery.testTitle}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {delivery.estimatedMinutes && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> ~{delivery.estimatedMinutes} min
            </Badge>
          )}
          {delivery.skillCount && (
            <Badge variant="outline">{delivery.skillCount} skills assessed</Badge>
          )}
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            {delivery.collectNameEmail && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="anon-name">
                    Your name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="anon-name"
                    placeholder="e.g. Alex Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="anon-email">Email (optional)</Label>
                  <Input
                    id="anon-email"
                    type="email"
                    placeholder="to receive your results"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleStart} disabled={starting} className="w-full">
              {starting ? 'Starting…' : 'Start Assessment'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Your responses will be used to generate a personalised report after you
              finish.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
