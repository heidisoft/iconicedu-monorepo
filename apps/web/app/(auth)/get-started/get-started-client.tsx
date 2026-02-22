'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@iconicedu/ui-web';

import { normalizeOrgSlug } from '@iconicedu/web/lib/org/slug';

export default function GetStartedClient() {
  const router = useRouter();
  const [orgName, setOrgName] = React.useState('');
  const [orgSlug, setOrgSlug] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setOrgName(value);
    if (!orgSlug.trim()) {
      setOrgSlug(normalizeOrgSlug(value));
    }
  };

  const handleSubmit = async () => {
    const trimmedName = orgName.trim();
    const normalizedSlug = normalizeOrgSlug(orgSlug);

    if (!trimmedName) {
      setErrorMessage('Organization name is required.');
      return;
    }

    if (!normalizedSlug) {
      setErrorMessage('Organization slug is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/orgs/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: trimmedName,
          slug: normalizedSlug,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            onboarding?: { destination?: string | null };
          }
        | null;

      if (!response.ok || !body?.success) {
        setErrorMessage(body?.message ?? 'Unable to create organization.');
        return;
      }

      router.replace(body.onboarding?.destination ?? '/d');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/60 bg-background p-6 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Set up your organization</h1>
        <p className="text-sm text-muted-foreground">
          You are the first user. Create your org to continue.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="orgName">Organization name</Label>
        <Input
          id="orgName"
          value={orgName}
          onChange={(event) => handleNameChange(event.target.value)}
          placeholder="ICONIC Academy"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="orgSlug">Organization slug</Label>
        <Input
          id="orgSlug"
          value={orgSlug}
          onChange={(event) => setOrgSlug(normalizeOrgSlug(event.target.value))}
          placeholder="iconic-academy"
        />
        <p className="text-xs text-muted-foreground">
          URL preview: `/{normalizeOrgSlug(orgSlug) || 'your-slug'}`
        </p>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create organization'}
        </Button>
      </div>
    </div>
  );
}
