'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';

/** Presentation only: identity, passcode verification and token issuance belong to apps/api. */
export function LiveSessionJoinForm({
  sessionTitle,
  participantName,
  initialPasscode,
  busy,
  error,
  onSubmit,
}: {
  sessionTitle: string;
  participantName?: string | null;
  initialPasscode?: string | null;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { displayName: string; passcode: string }) => void;
}) {
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState(initialPasscode ?? '');
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ displayName: participantName ?? name.trim(), passcode: passcode.trim() });
  };
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{sessionTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {participantName ? `Joining as ${participantName}` : 'Enter your name to join.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4" aria-label="Join live session">
        {!participantName && (
          <div className="space-y-2">
            <Label htmlFor="live-display-name">Your name</Label>
            <Input
              id="live-display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jordan Lee"
              autoFocus
              required
              disabled={busy}
            />
          </div>
        )}
        {(!initialPasscode || error) && (
          <div className="space-y-2">
            <Label htmlFor="live-passcode">Session passcode</Label>
            <Input
              id="live-passcode"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              required
              disabled={busy}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Joining…' : 'Join session'}
        </Button>
      </form>
    </div>
  );
}
