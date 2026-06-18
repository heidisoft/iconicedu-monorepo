'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type {
  AssessmentTestVM,
  AssessmentTestMode,
  AdaptiveConfig,
} from '@iconicedu/shared-types';
import { DEFAULT_ADAPTIVE_CONFIG } from '@iconicedu/shared-types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
} from '@iconicedu/ui-web';
import { AlertCircle } from 'lucide-react';

interface Props {
  orgId: string;
  orgSlug: string;
  test?: AssessmentTestVM;
}

export function TestForm({ orgId, orgSlug, test }: Props) {
  const router = useRouter();
  const isEdit = !!test;

  const [title, setTitle] = useState(test?.title ?? '');
  const [description, setDescription] = useState(test?.description ?? '');
  const [instructions, setInstructions] = useState(test?.instructions ?? '');
  const [mode, setMode] = useState<AssessmentTestMode>(test?.mode ?? 'standard');
  const [timeLimit, setTimeLimit] = useState<number | ''>(test?.timeLimitMinutes ?? '');
  const [passingScore, setPassingScore] = useState<number | ''>(
    test?.passingScorePercent ?? '',
  );
  const [showResultsImmediately, setShowResultsImmediately] = useState(
    test?.showResultsImmediately ?? true,
  );
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(
    test?.showCorrectAnswers ?? false,
  );
  const [adaptiveConfig, setAdaptiveConfig] = useState<AdaptiveConfig>(
    test?.adaptiveConfig ?? DEFAULT_ADAPTIVE_CONFIG,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const api = createAssessmentApiClient(createSupabaseBrowserClient());
      const body = {
        orgId,
        title: title.trim(),
        description: description || undefined,
        instructions: instructions || undefined,
        mode,
        timeLimitMinutes: timeLimit !== '' ? timeLimit : undefined,
        passingScorePercent: passingScore !== '' ? passingScore : undefined,
        showResultsImmediately,
        showCorrectAnswers,
        adaptiveConfig: mode === 'adaptive' ? adaptiveConfig : undefined,
      };
      if (isEdit) {
        await api.updateTest(test.id, body);
        router.refresh();
      } else {
        const created = await api.createTest(body);
        router.push(`/${orgSlug}/admin/assessments/tests/${created.id}`);
      }
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Test details</CardTitle>
          <CardDescription>
            Name your test and set the mode — standard tests use a fixed question order,
            adaptive tests select questions based on student performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Grade 4 Math — Fractions Diagnostic"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description for educators…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Student instructions</Label>
            <Textarea
              placeholder="Instructions shown to students before they start…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="mb-1.5 block">Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as AssessmentTestMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    Standard — fixed question order
                  </SelectItem>
                  <SelectItem value="adaptive">
                    Adaptive — engine selects questions live
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="mb-1.5 block">Time limit (min)</Label>
              <Input
                type="number"
                placeholder="None"
                value={timeLimit}
                onChange={(e) =>
                  setTimeLimit(e.target.value ? Number(e.target.value) : '')
                }
              />
            </div>
            <div className="w-32">
              <Label className="mb-1.5 block">Pass % (optional)</Label>
              <Input
                type="number"
                placeholder="None"
                value={passingScore}
                onChange={(e) =>
                  setPassingScore(e.target.value ? Number(e.target.value) : '')
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Results settings</CardTitle>
          <CardDescription>
            Control what students see after completing the test.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 divide-y">
          <div className="flex items-center justify-between py-4 first:pt-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Show results immediately</span>
              <span className="text-xs text-muted-foreground">
                Students see their score as soon as they submit
              </span>
            </div>
            <Switch
              checked={showResultsImmediately}
              onCheckedChange={setShowResultsImmediately}
            />
          </div>
          <div className="flex items-center justify-between py-4 last:pb-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Show correct answers</span>
              <span className="text-xs text-muted-foreground">
                Reveal correct answers after the test is completed
              </span>
            </div>
            <Switch
              checked={showCorrectAnswers}
              onCheckedChange={setShowCorrectAnswers}
            />
          </div>
        </CardContent>
      </Card>

      {mode === 'adaptive' && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Adaptive rules</CardTitle>
            <CardDescription>
              Configure how the engine adjusts difficulty, injects prerequisites, and
              decides when a skill is resolved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['prereqTriggerMissCount', 'Miss threshold (trigger prerequisites)'],
                  ['prereqItemsToInject', 'Prerequisite items to inject'],
                  ['advanceTriggerCorrectCount', 'Correct streak to advance difficulty'],
                  ['advanceDifficultyStep', 'Difficulty step when advancing'],
                  ['stopOnConsecutiveCorrect', 'Stop after N consecutive correct'],
                  ['stopOnConsecutiveWrong', 'Stop after N consecutive wrong'],
                  ['minItemsPerSkill', 'Minimum items per skill'],
                  ['maxItemsPerSkill', 'Maximum items per skill'],
                ] as [keyof AdaptiveConfig, string][]
              ).map(([key, label]) => (
                <div key={key} className="flex flex-col gap-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={adaptiveConfig[key]}
                    onChange={(e) =>
                      setAdaptiveConfig((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create test'}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
