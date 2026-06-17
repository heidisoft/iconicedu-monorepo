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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
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
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>
              Delivery title <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Grade 4 Fractions — Spring 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label>
                Test <span className="text-destructive">*</span>
              </Label>
              <Select value={testId} onValueChange={setTestId}>
                <SelectTrigger>
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
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="mb-1.5 block">Access type</Label>
              <Select
                value={accessType}
                onValueChange={(v) => setAccessType(v as AssessmentAccessType)}
              >
                <SelectTrigger>
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
            <div className="w-32">
              <Label className="mb-1.5 block">Max attempts</Label>
              <Input
                type="number"
                min="1"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Collect name & email (for anonymous)</Label>
              <Switch checked={collectNameEmail} onCheckedChange={setCollectNameEmail} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Allow resume</Label>
              <Switch checked={allowResume} onCheckedChange={setAllowResume} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create delivery'}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
