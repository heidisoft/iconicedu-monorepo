'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type {
  AssessmentDeliveryVM,
  AssessmentAccessType,
  AssessmentTestListVM,
} from '@iconicedu/shared-types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Separator,
} from '@iconicedu/ui-web';

interface Props {
  orgId: string;
  orgSlug: string;
  tests: AssessmentTestListVM[];
  delivery?: AssessmentDeliveryVM;
}

export function DeliveryForm({ orgId, orgSlug, tests, delivery }: Props) {
  const router = useRouter();
  const isEdit = !!delivery;

  const [title, setTitle] = useState(delivery?.title ?? '');
  const [testId, setTestId] = useState(delivery?.testId ?? tests[0]?.id ?? '');
  const [accessType, setAccessType] = useState<AssessmentAccessType>(
    delivery?.accessType ?? 'public',
  );
  const [maxAttempts, setMaxAttempts] = useState(delivery?.maxAttempts ?? 1);
  const [collectNameEmail, setCollectNameEmail] = useState(
    delivery?.collectNameEmail ?? false,
  );
  const [allowResume, setAllowResume] = useState(delivery?.allowResume ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!title.trim() || !testId) {
      setError('Title and test are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const api = createAssessmentApiClient(createSupabaseBrowserClient());
      if (isEdit) {
        await api.updateDelivery(delivery.id, {
          orgId,
          title: title.trim(),
          accessType,
          maxAttempts,
          collectNameEmail,
          allowResume,
        });
        router.refresh();
      } else {
        const created = await api.createDelivery({
          orgId,
          testId,
          title: title.trim(),
          accessType,
          maxAttempts,
          collectNameEmail,
          allowResume,
        });
        router.push(`/${orgSlug}/admin/assessments/deliveries/${created.id}`);
      }
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Basic details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>
            Name this delivery so you can identify it in the list.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-title">
              Delivery title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="delivery-title"
              placeholder="e.g. Grade 4 Fractions — Spring 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="test-select">
                Test <span className="text-destructive">*</span>
              </Label>
              {tests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tests available.{' '}
                  <a
                    href={`/${orgSlug}/admin/assessments/tests/new`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Create a test first.
                  </a>
                </p>
              ) : (
                <Select value={testId} onValueChange={setTestId}>
                  <SelectTrigger id="test-select">
                    <SelectValue placeholder="Select a test…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tests.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Access</CardTitle>
          <CardDescription>
            Control who can take this assessment and how many times.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="access-type">Access type</Label>
              <Select
                value={accessType}
                onValueChange={(v) => setAccessType(v as AssessmentAccessType)}
              >
                <SelectTrigger id="access-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — anyone with the link</SelectItem>
                  <SelectItem value="authenticated">
                    Authenticated — logged-in users only
                  </SelectItem>
                  <SelectItem value="class">Class — channel members only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-attempts">Max attempts</Label>
              <Input
                id="max-attempts"
                type="number"
                min="1"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">per participant</p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium">Collect name &amp; email</Label>
                <p className="text-xs text-muted-foreground">
                  Ask anonymous participants for their details before starting.
                </p>
              </div>
              <Switch checked={collectNameEmail} onCheckedChange={setCollectNameEmail} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium">Allow resume</Label>
                <p className="text-xs text-muted-foreground">
                  Participants can close and return to finish later.
                </p>
              </div>
              <Switch checked={allowResume} onCheckedChange={setAllowResume} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !title.trim() || (!isEdit && !testId)}
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create delivery'}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
