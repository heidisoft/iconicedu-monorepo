'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import type {
  AssessmentItemVM,
  AssessmentItemType,
  AssessmentSkillVM,
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
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@iconicedu/ui-web';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { SkillPicker } from './skill-picker';

interface Props {
  orgId: string;
  orgSlug: string;
  item?: AssessmentItemVM;
}

const ITEM_TYPES: { value: AssessmentItemType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'multiple_response', label: 'Multiple Response' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'matching', label: 'Matching' },
  { value: 'gap_match', label: 'Fill in the Blank' },
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
      setError('Title and skill are required.');
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
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="question">
        <TabsList>
          <TabsTrigger value="question">Question</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="question" className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>Question title / reference</Label>
            <Input
              placeholder="e.g. Compare fractions with unlike denominators – Q1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="mb-1.5 block">Question type</Label>
              <Select
                value={type}
                onValueChange={(v) => handleTypeChange(v as AssessmentItemType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ContentEditor type={type} content={content} onChange={setContent} />
        </TabsContent>

        <TabsContent value="metadata" className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>
              Skill <span className="text-destructive">*</span>
            </Label>
            <SkillPicker
              orgId={orgId}
              value={skillId}
              onChange={(id) => setSkillId(id)}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="mb-1.5 block">Difficulty (1–5)</Label>
              <Select
                value={String(difficulty)}
                onValueChange={(v) => setDifficulty(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} — {['', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'][d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="mb-1.5 block">Estimated time (seconds)</Label>
              <Input
                type="number"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Explanation (shown after answering)</Label>
            <Textarea
              placeholder="Explain the correct answer…"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="min-h-24 resize-none"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
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
// ContentEditor — renders the appropriate form for each item type
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

// MCQ / Multiple response
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Question stem</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          placeholder="Enter the question…"
          value={content.stem}
          onChange={(e) => onChange({ ...content, stem: e.target.value })}
          className="min-h-20 resize-none"
        />
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">
            {multiple ? 'Select all correct options' : 'Click the correct answer'}
          </Label>
          {content.options.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(opt.id)}
                className={`flex-shrink-0 h-5 w-5 rounded-${multiple ? 'sm' : 'full'} border-2 transition-colors ${opt.correct ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                title="Mark as correct"
              />
              <Input
                value={opt.text}
                onChange={(e) => updateOption(opt.id, 'text', e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="h-8 text-sm flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => removeOption(opt.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="self-start text-xs h-7"
            onClick={addOption}
          >
            <Plus className="mr-1 h-3 w-3" /> Add option
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// True / False
function TrueFalseEditor({
  content,
  onChange,
}: {
  content: TrueFalseContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          placeholder="Enter the statement…"
          value={content.stem}
          onChange={(e) => onChange({ ...content, stem: e.target.value })}
          className="min-h-20 resize-none"
        />
        <div className="flex gap-3">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange({ ...content, correct: val })}
              className={`flex-1 py-2 rounded-md border-2 text-sm font-medium transition-colors ${content.correct === val ? 'border-primary bg-primary/10' : 'border-muted hover:border-muted-foreground'}`}
            >
              {val ? 'True' : 'False'} {content.correct === val && '✓'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Click to mark the correct answer.</p>
      </CardContent>
    </Card>
  );
}

// Short answer
function ShortAnswerEditor({
  content,
  onChange,
}: {
  content: ShortAnswerContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          placeholder="Enter the question…"
          value={content.stem}
          onChange={(e) => onChange({ ...content, stem: e.target.value })}
          className="min-h-20 resize-none"
        />
        <Label className="text-xs">Accepted answers (add multiple for variations)</Label>
        {content.correctAnswers.map((answer, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={answer}
              onChange={(e) => {
                const correctAnswers = [...content.correctAnswers];
                correctAnswers[i] = e.target.value;
                onChange({ ...content, correctAnswers });
              }}
              placeholder="Accepted answer…"
              className="h-8 text-sm"
            />
            {i > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
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
          className="self-start text-xs h-7"
          onClick={() => {
            onChange({ ...content, correctAnswers: [...content.correctAnswers, ''] });
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Add variation
        </Button>
      </CardContent>
    </Card>
  );
}

// Essay
function EssayEditor({
  content,
  onChange,
}: {
  content: EssayContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          placeholder="Enter the essay prompt…"
          value={content.stem}
          onChange={(e) => onChange({ ...content, stem: e.target.value })}
          className="min-h-24 resize-none"
        />
        <div>
          <Label className="text-xs mb-1 block">Rubric (optional, shown to grader)</Label>
          <Textarea
            placeholder="Grading rubric…"
            value={content.rubric ?? ''}
            onChange={(e) => onChange({ ...content, rubric: e.target.value })}
            className="min-h-16 resize-none text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs">Word limit</Label>
          <Input
            type="number"
            className="h-8 w-28 text-sm"
            placeholder="None"
            value={content.wordLimit ?? ''}
            onChange={(e) =>
              onChange({
                ...content,
                wordLimit: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
        <Badge variant="outline" className="w-fit text-xs">
          Manual grading required
        </Badge>
      </CardContent>
    </Card>
  );
}

// Ordering
function OrderingEditor({
  content,
  onChange,
}: {
  content: OrderingContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          placeholder="Enter the ordering prompt…"
          value={content.stem}
          onChange={(e) => onChange({ ...content, stem: e.target.value })}
          className="min-h-20 resize-none"
        />
        <Label className="text-xs">Items in correct order (top = first)</Label>
        {content.items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground w-4 flex-shrink-0">
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
              className="h-8 text-sm flex-1"
            />
            {content.items.length > 2 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
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
          className="self-start text-xs h-7"
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
      </CardContent>
    </Card>
  );
}

// Matching
function MatchingEditor({
  content,
  onChange,
}: {
  content: MatchingContent;
  onChange: (c: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          placeholder="Matching prompt…"
          value={content.stem}
          onChange={(e) => onChange({ ...content, stem: e.target.value })}
          className="min-h-16 resize-none"
        />
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-1">
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
              className="h-8 text-sm"
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
                className="h-8 text-sm flex-1"
              />
              {content.pairs.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 flex-shrink-0"
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
          className="self-start text-xs h-7"
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
      </CardContent>
    </Card>
  );
}

// Gap match (fill-in-the-blank)
function GapMatchEditor({
  content,
  onChange,
}: {
  content: { stem: string; gaps: { id: string; answer: string }[] };
  onChange: (c: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div>
          <Label className="text-xs mb-1 block">
            Question with blanks — use _____ for each blank
          </Label>
          <Textarea
            placeholder="The capital of France is _____."
            value={content.stem}
            onChange={(e) => onChange({ ...content, stem: e.target.value })}
            className="min-h-20 resize-none"
          />
        </div>
        <Label className="text-xs">Correct answers for each blank (in order)</Label>
        {content.gaps.map((gap, i) => (
          <div key={gap.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex-shrink-0">
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
              className="h-8 text-sm flex-1"
            />
            {content.gaps.length > 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
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
          className="self-start text-xs h-7"
          onClick={() => {
            onChange({
              ...content,
              gaps: [...content.gaps, { id: generateId(), answer: '' }],
            });
          }}
        >
          <Plus className="mr-1 h-3 w-3" /> Add blank
        </Button>
      </CardContent>
    </Card>
  );
}
