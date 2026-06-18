'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type {
  AssessmentItemVM,
  AssessmentItemType,
  ItemOption,
  MultipleChoiceContent,
  TrueFalseContent,
  ShortAnswerContent,
  EssayContent,
  OrderingContent,
  MatchingContent,
} from '@iconicedu/shared-types';
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
  Textarea,
  Badge,
} from '@iconicedu/ui-web';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { SkillPicker } from './skill-picker';

interface Props {
  orgId: string;
  orgSlug: string;
  item?: AssessmentItemVM;
}

const ITEM_TYPES: { value: AssessmentItemType; label: string; description: string }[] = [
  {
    value: 'multiple_choice',
    label: 'Multiple Choice',
    description: 'One correct answer',
  },
  {
    value: 'multiple_response',
    label: 'Multiple Response',
    description: 'One or more correct answers',
  },
  {
    value: 'true_false',
    label: 'True / False',
    description: 'Binary correct/incorrect statement',
  },
  {
    value: 'short_answer',
    label: 'Short Answer',
    description: 'Student types a short response',
  },
  { value: 'essay', label: 'Essay', description: 'Extended response, manually graded' },
  {
    value: 'ordering',
    label: 'Ordering',
    description: 'Arrange items in correct sequence',
  },
  {
    value: 'matching',
    label: 'Matching',
    description: 'Connect left and right column pairs',
  },
  {
    value: 'gap_match',
    label: 'Fill in the Blank',
    description: 'Complete missing words',
  },
];

const DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Expert' },
];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultContent(type: AssessmentItemType): unknown {
  switch (type) {
    case 'multiple_choice':
    case 'multiple_response':
      return {
        stem: '',
        options: [
          { id: generateId(), text: '', correct: false },
          { id: generateId(), text: '', correct: false },
        ],
        shuffle: false,
      } satisfies MultipleChoiceContent;
    case 'true_false':
      return { stem: '', correct: true } satisfies TrueFalseContent;
    case 'short_answer':
      return {
        stem: '',
        correctAnswers: [''],
        caseSensitive: false,
        partialCredit: false,
      } satisfies ShortAnswerContent;
    case 'essay':
      return { stem: '', rubric: '', wordLimit: null } satisfies EssayContent;
    case 'ordering':
      return {
        stem: '',
        items: [
          { id: generateId(), text: '', correctPosition: 0 },
          { id: generateId(), text: '', correctPosition: 1 },
        ],
        shuffle: true,
      } satisfies OrderingContent;
    case 'matching':
      return {
        stem: '',
        pairs: [
          { left: { id: generateId(), text: '' }, right: { id: generateId(), text: '' } },
        ],
        shuffleRight: true,
      } satisfies MatchingContent;
    case 'gap_match':
      return { stem: '', gaps: [{ id: generateId(), answer: '' }] };
  }
}

export function ItemEditor({ orgId, orgSlug, item }: Props) {
  const router = useRouter();
  const isEdit = !!item;

  const [title, setTitle] = useState(item?.title ?? '');
  const [type, setType] = useState<AssessmentItemType>(item?.type ?? 'multiple_choice');
  const [skillId, setSkillId] = useState(item?.skillId ?? '');
  const [difficulty, setDifficulty] = useState(item?.difficulty ?? 3);
  const [estimatedTime, setEstimatedTime] = useState(item?.estimatedTimeSeconds ?? 90);
  const [explanation, setExplanation] = useState(item?.explanation ?? '');
  const [content, setContent] = useState<unknown>(
    item?.content ?? defaultContent('multiple_choice'),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleTypeChange(t: AssessmentItemType) {
    setType(t);
    setContent(defaultContent(t));
  }

  async function handleSave() {
    if (!title.trim() || !skillId) {
      setError('Question title and skill are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const api = createAssessmentApiClient(createSupabaseBrowserClient());
      if (isEdit) {
        await api.updateItem(item.id, {
          orgId,
          title: title.trim(),
          type,
          skillId,
          content,
          difficulty,
          estimatedTimeSeconds: estimatedTime,
          explanation: explanation || undefined,
        });
      } else {
        await api.createItem({
          orgId,
          skillId,
          title: title.trim(),
          type,
          content,
          difficulty,
          estimatedTimeSeconds: estimatedTime,
          explanation: explanation || undefined,
        });
      }
      router.push(`/${orgSlug}/admin/assessments/items`);
      router.refresh();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Question section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Question</CardTitle>
          <CardDescription>
            Set the question title, type, and content. The title is your internal
            reference — it won&apos;t be shown to students.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-title">
              Question title / reference <span className="text-destructive">*</span>
            </Label>
            <Input
              id="item-title"
              placeholder="e.g. Compare fractions with unlike denominators – Q1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-type">Question type</Label>
            <Select
              value={type}
              onValueChange={(v) => handleTypeChange(v as AssessmentItemType)}
            >
              <SelectTrigger id="item-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span>{t.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                      — {t.description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <ContentEditor type={type} content={content} onChange={setContent} />
        </CardContent>
      </Card>

      {/* Metadata section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Metadata</CardTitle>
          <CardDescription>
            Tag this question to a skill and set its difficulty so the adaptive engine can
            select it appropriately.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label>
              Skill <span className="text-destructive">*</span>
            </Label>
            <SkillPicker
              orgId={orgId}
              value={skillId}
              onChange={(id) => setSkillId(id)}
            />
            <p className="text-xs text-muted-foreground">
              The skill this question assesses. Used for skill-level scoring and the
              adaptive engine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-difficulty">Difficulty</Label>
              <Select
                value={String(difficulty)}
                onValueChange={(v) => setDifficulty(Number(v))}
              >
                <SelectTrigger id="item-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label} (Level {d.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-time">Estimated time (seconds)</Label>
              <Input
                id="item-time"
                type="number"
                min={10}
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-explanation">Explanation (optional)</Label>
            <Textarea
              id="item-explanation"
              placeholder="Explain the correct answer — shown to students after they submit."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="min-h-24 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create question'}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ContentEditor
// ──────────────────────────────────────────────────────────────────────────────

interface ContentEditorProps {
  type: AssessmentItemType;
  content: unknown;
  onChange: (c: unknown) => void;
}

function ContentEditor({ type, content, onChange }: ContentEditorProps) {
  switch (type) {
    case 'multiple_choice':
    case 'multiple_response':
      return (
        <MCQEditor
          multiple={type === 'multiple_response'}
          content={content as MultipleChoiceContent}
          onChange={onChange}
        />
      );
    case 'true_false':
      return (
        <TrueFalseEditor content={content as TrueFalseContent} onChange={onChange} />
      );
    case 'short_answer':
      return (
        <ShortAnswerEditor content={content as ShortAnswerContent} onChange={onChange} />
      );
    case 'essay':
      return <EssayEditor content={content as EssayContent} onChange={onChange} />;
    case 'ordering':
      return <OrderingEditor content={content as OrderingContent} onChange={onChange} />;
    case 'matching':
      return <MatchingEditor content={content as MatchingContent} onChange={onChange} />;
    case 'gap_match':
      return (
        <GapMatchEditor
          content={content as { stem: string; gaps: { id: string; answer: string }[] }}
          onChange={onChange}
        />
      );
  }
}

// ── Shared stem field ──────────────────────────────────────────────────────────

function StemField({
  value,
  onChange,
  placeholder = 'Enter the question…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Question stem</Label>
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-20 resize-none"
      />
    </div>
  );
}

// ── MCQ / Multiple response ────────────────────────────────────────────────────

function MCQEditor({
  multiple,
  content,
  onChange,
}: {
  multiple: boolean;
  content: MultipleChoiceContent;
  onChange: (c: unknown) => void;
}) {
  function updateOption(id: string, field: keyof ItemOption, value: string | boolean) {
    const options = content.options.map((o) =>
      o.id === id ? { ...o, [field]: value } : o,
    );
    onChange({ ...content, options });
  }

  function toggleCorrect(id: string) {
    const options = content.options.map((o) =>
      multiple
        ? o.id === id
          ? { ...o, correct: !o.correct }
          : o
        : { ...o, correct: o.id === id },
    );
    onChange({ ...content, options });
  }

  function addOption() {
    onChange({
      ...content,
      options: [...content.options, { id: generateId(), text: '', correct: false }],
    });
  }

  function removeOption(id: string) {
    onChange({ ...content, options: content.options.filter((o) => o.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4">
      <StemField
        value={content.stem}
        onChange={(v) => onChange({ ...content, stem: v })}
      />

      <div className="flex flex-col gap-2">
        <Label className="text-sm">
          Answer options
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {multiple ? 'Check all correct answers' : 'Click to mark the correct answer'}
          </span>
        </Label>
        {content.options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCorrect(opt.id)}
              className={`flex-shrink-0 h-5 w-5 rounded-${multiple ? 'sm' : 'full'} border-2 transition-colors ${
                opt.correct
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground hover:border-primary'
              }`}
              title="Mark as correct"
            />
            <Input
              value={opt.text}
              onChange={(e) => updateOption(opt.id, 'text', e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="h-9 text-sm flex-1"
            />
            {content.options.length > 2 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeOption(opt.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-xs h-7 text-muted-foreground"
          onClick={addOption}
        >
          <Plus className="mr-1 h-3 w-3" /> Add option
        </Button>
      </div>
    </div>
  );
}

// ── True / False ───────────────────────────────────────────────────────────────

function TrueFalseEditor({
  content,
  onChange,
}: {
  content: TrueFalseContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StemField
        value={content.stem}
        onChange={(v) => onChange({ ...content, stem: v })}
        placeholder="Enter the statement to evaluate…"
      />
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm">Correct answer</Label>
        <div className="flex gap-3">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange({ ...content, correct: val })}
              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                content.correct === val
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              {val ? 'True' : 'False'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Short answer ───────────────────────────────────────────────────────────────

function ShortAnswerEditor({
  content,
  onChange,
}: {
  content: ShortAnswerContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StemField
        value={content.stem}
        onChange={(v) => onChange({ ...content, stem: v })}
      />
      <div className="flex flex-col gap-2">
        <Label className="text-sm">
          Accepted answers
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Add multiple variations for flexible marking
          </span>
        </Label>
        {content.correctAnswers.map((answer, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={answer}
              onChange={(e) => {
                const correctAnswers = [...content.correctAnswers];
                correctAnswers[i] = e.target.value;
                onChange({ ...content, correctAnswers });
              }}
              placeholder={`Variation ${i + 1}…`}
              className="h-9 text-sm"
            />
            {i > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  onChange({
                    ...content,
                    correctAnswers: content.correctAnswers.filter((_, j) => j !== i),
                  });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-xs h-7 text-muted-foreground"
          onClick={() => {
            onChange({ ...content, correctAnswers: [...content.correctAnswers, ''] });
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Add variation
        </Button>
      </div>
    </div>
  );
}

// ── Essay ──────────────────────────────────────────────────────────────────────

function EssayEditor({
  content,
  onChange,
}: {
  content: EssayContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StemField
        value={content.stem}
        onChange={(v) => onChange({ ...content, stem: v })}
        placeholder="Enter the essay prompt…"
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="essay-rubric" className="text-sm">
          Grading rubric
          <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>
        </Label>
        <Textarea
          id="essay-rubric"
          placeholder="Describe how to grade this essay…"
          value={content.rubric ?? ''}
          onChange={(e) => onChange({ ...content, rubric: e.target.value })}
          className="min-h-16 resize-none text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <Label htmlFor="essay-word-limit" className="text-sm shrink-0">
          Word limit
        </Label>
        <Input
          id="essay-word-limit"
          type="number"
          className="h-9 w-28 text-sm"
          placeholder="No limit"
          value={content.wordLimit ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              wordLimit: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
        <Badge variant="outline" className="text-xs">
          Manual grading required
        </Badge>
      </div>
    </div>
  );
}

// ── Ordering ───────────────────────────────────────────────────────────────────

function OrderingEditor({
  content,
  onChange,
}: {
  content: OrderingContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StemField
        value={content.stem}
        onChange={(v) => onChange({ ...content, stem: v })}
        placeholder="Enter the ordering prompt…"
      />
      <div className="flex flex-col gap-2">
        <Label className="text-sm">
          Items in correct order
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            top = position 1
          </span>
        </Label>
        {content.items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground w-5 flex-shrink-0 tabular-nums">
              {i + 1}.
            </span>
            <Input
              value={item.text}
              onChange={(e) => {
                const items = content.items.map((it, j) =>
                  j === i ? { ...it, text: e.target.value, correctPosition: i } : it,
                );
                onChange({ ...content, items });
              }}
              placeholder={`Item ${i + 1}…`}
              className="h-9 text-sm flex-1"
            />
            {content.items.length > 2 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  const items = content.items
                    .filter((_, j) => j !== i)
                    .map((it, j) => ({ ...it, correctPosition: j }));
                  onChange({ ...content, items });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-xs h-7 text-muted-foreground"
          onClick={() => {
            const newItem = {
              id: generateId(),
              text: '',
              correctPosition: content.items.length,
            };
            onChange({ ...content, items: [...content.items, newItem] });
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Add item
        </Button>
      </div>
    </div>
  );
}

// ── Matching ───────────────────────────────────────────────────────────────────

function MatchingEditor({
  content,
  onChange,
}: {
  content: MatchingContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <StemField
        value={content.stem}
        onChange={(v) => onChange({ ...content, stem: v })}
        placeholder="Matching prompt…"
      />
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground px-0.5">
          <span>Left column</span>
          <span>Right column (match)</span>
        </div>
        {content.pairs.map((pair, i) => (
          <div key={pair.left.id} className="grid grid-cols-2 gap-2 items-center">
            <Input
              value={pair.left.text}
              onChange={(e) => {
                const pairs = content.pairs.map((p, j) =>
                  j === i ? { ...p, left: { ...p.left, text: e.target.value } } : p,
                );
                onChange({ ...content, pairs });
              }}
              placeholder={`Left ${i + 1}`}
              className="h-9 text-sm"
            />
            <div className="flex gap-1">
              <Input
                value={pair.right.text}
                onChange={(e) => {
                  const pairs = content.pairs.map((p, j) =>
                    j === i ? { ...p, right: { ...p.right, text: e.target.value } } : p,
                  );
                  onChange({ ...content, pairs });
                }}
                placeholder={`Right ${i + 1}`}
                className="h-9 text-sm flex-1"
              />
              {content.pairs.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    onChange({
                      ...content,
                      pairs: content.pairs.filter((_, j) => j !== i),
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-xs h-7 text-muted-foreground"
          onClick={() => {
            const pair = {
              left: { id: generateId(), text: '' },
              right: { id: generateId(), text: '' },
            };
            onChange({ ...content, pairs: [...content.pairs, pair] });
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Add pair
        </Button>
      </div>
    </div>
  );
}

// ── Gap match (fill-in-the-blank) ─────────────────────────────────────────────

function GapMatchEditor({
  content,
  onChange,
}: {
  content: { stem: string; gaps: { id: string; answer: string }[] };
  onChange: (c: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>
          Question with blanks
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            use _____ for each blank
          </span>
        </Label>
        <Textarea
          placeholder="The capital of France is _____."
          value={content.stem}
          onChange={(e) => onChange({ ...content, stem: e.target.value })}
          className="min-h-20 resize-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-sm">
          Correct answers
          <span className="ml-2 text-xs font-normal text-muted-foreground">in order</span>
        </Label>
        {content.gaps.map((gap, i) => (
          <div key={gap.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex-shrink-0 w-14 tabular-nums">
              Blank {i + 1}:
            </span>
            <Input
              value={gap.answer}
              onChange={(e) => {
                const gaps = content.gaps.map((g, j) =>
                  j === i ? { ...g, answer: e.target.value } : g,
                );
                onChange({ ...content, gaps });
              }}
              placeholder="Correct answer…"
              className="h-9 text-sm flex-1"
            />
            {content.gaps.length > 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  onChange({ ...content, gaps: content.gaps.filter((_, j) => j !== i) });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-xs h-7 text-muted-foreground"
          onClick={() => {
            onChange({
              ...content,
              gaps: [...content.gaps, { id: generateId(), answer: '' }],
            });
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Add blank
        </Button>
      </div>
    </div>
  );
}
