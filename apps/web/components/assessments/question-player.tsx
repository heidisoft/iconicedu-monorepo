'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AssessmentItemVM,
  AssessmentNextItemVM,
  MultipleChoiceContent,
  TrueFalseContent,
  ShortAnswerContent,
  EssayContent,
  OrderingContent,
  MatchingContent,
} from '@iconicedu/shared-types';
import { Button, Badge, Card, CardContent } from '@iconicedu/ui-web';
import { ChevronRight, Flag } from 'lucide-react';

interface Props {
  sessionId: string;
  initialItem: AssessmentItemVM;
  initialState: AssessmentNextItemVM;
  onSaveResponse: (
    sessionId: string,
    body: { itemId: string; responseData: unknown; timeSpentSeconds: number },
  ) => Promise<AssessmentNextItemVM | null>;
  onSubmit: (sessionId: string) => Promise<void>;
  redirectOnComplete: string;
}

type ResponseData = unknown;

export function QuestionPlayer({
  sessionId,
  initialItem,
  initialState,
  onSaveResponse,
  onSubmit,
  redirectOnComplete,
}: Props) {
  const router = useRouter();
  const [currentItem, setCurrentItem] = useState<AssessmentItemVM>(initialItem);
  const [state, setState] = useState<AssessmentNextItemVM>(initialState);
  const [response, setResponse] = useState<ResponseData>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setResponse(null);
  }, [currentItem.id]);

  async function handleNext() {
    setSubmitting(true);
    try {
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      const next = await onSaveResponse(sessionId, {
        itemId: currentItem.id,
        responseData: response,
        timeSpentSeconds: timeSpent,
      });
      if (!next) return;
      setState(next);
      if (next.isComplete || !next.nextItem) {
        await handleComplete();
      } else {
        setCurrentItem(next.nextItem);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    await onSubmit(sessionId);
    router.push(redirectOnComplete);
  }

  const answered = response !== null && response !== undefined && response !== '';
  const progress = state.itemsTotal
    ? Math.round((state.itemsAnswered / state.itemsTotal) * 100)
    : null;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {state.itemsAnswered + 1}
            {state.itemsTotal ? ` of ${state.itemsTotal}` : ''}
          </span>
          {state.adaptiveNote && (
            <span className="text-blue-500 italic">{state.adaptiveNote}</span>
          )}
          {progress !== null && <span>{progress}%</span>}
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
      </div>

      {/* Item metadata */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {currentItem.skillName}
        </Badge>
        <div className="flex gap-0.5" title={`Difficulty: ${currentItem.difficulty}`}>
          {[1, 2, 3, 4, 5].map((d) => (
            <div
              key={d}
              className={`h-1.5 w-1.5 rounded-full ${d <= currentItem.difficulty ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <ItemResponseWidget item={currentItem} response={response} onChange={setResponse} />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div />
        {state.isComplete ? (
          <Button onClick={handleComplete} disabled={completing}>
            {completing ? 'Finishing…' : 'See Results'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={submitting || !answered}>
            {submitting ? 'Saving…' : 'Next'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ItemResponseWidget
// ──────────────────────────────────────────────────────────────────────────────

interface WidgetProps {
  item: AssessmentItemVM;
  response: ResponseData;
  onChange: (r: ResponseData) => void;
}

function ItemResponseWidget({ item, response, onChange }: WidgetProps) {
  switch (item.type) {
    case 'multiple_choice':
      return (
        <MCQWidget
          content={item.content as MultipleChoiceContent}
          multiple={false}
          response={response as string | null}
          onChange={onChange}
        />
      );
    case 'multiple_response':
      return (
        <MCQWidget
          content={item.content as MultipleChoiceContent}
          multiple={true}
          response={response as string[] | null}
          onChange={onChange}
        />
      );
    case 'true_false':
      return (
        <TrueFalseWidget
          content={item.content as TrueFalseContent}
          response={response as boolean | null}
          onChange={onChange}
        />
      );
    case 'short_answer':
      return (
        <ShortAnswerWidget
          content={item.content as ShortAnswerContent}
          response={response as string}
          onChange={onChange}
        />
      );
    case 'essay':
      return (
        <EssayWidget
          content={item.content as EssayContent}
          response={response as string}
          onChange={onChange}
        />
      );
    case 'ordering':
      return (
        <OrderingWidget
          content={item.content as OrderingContent}
          response={response as string[]}
          onChange={onChange}
        />
      );
    case 'matching':
      return (
        <MatchingWidget
          content={item.content as MatchingContent}
          response={response as Record<string, string>}
          onChange={onChange}
        />
      );
    case 'gap_match':
      return (
        <GapMatchWidget
          content={
            item.content as { stem: string; gaps: { id: string; answer: string }[] }
          }
          response={response as Record<string, string>}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

// MCQ / Multiple response
function MCQWidget({
  content,
  multiple,
  response,
  onChange,
}: {
  content: MultipleChoiceContent;
  multiple: boolean;
  response: string | string[] | null;
  onChange: (r: unknown) => void;
}) {
  const selectedIds = multiple
    ? ((response as string[]) ?? [])
    : response
      ? [response as string]
      : [];

  function toggle(optionId: string) {
    if (multiple) {
      const curr = (response as string[]) ?? [];
      onChange(
        curr.includes(optionId)
          ? curr.filter((id) => id !== optionId)
          : [...curr, optionId],
      );
    } else {
      onChange(optionId);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <p className="text-base leading-relaxed">{content.stem}</p>
        <div className="flex flex-col gap-2">
          {content.options.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${selectedIds.includes(opt.id) ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'}`}
            >
              <span
                className={`flex-shrink-0 h-6 w-6 rounded-${multiple ? 'md' : 'full'} border-2 flex items-center justify-center text-xs font-medium transition-colors ${selectedIds.includes(opt.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-sm">{opt.text}</span>
            </button>
          ))}
        </div>
        {multiple && (
          <p className="text-xs text-muted-foreground">Select all that apply</p>
        )}
      </CardContent>
    </Card>
  );
}

// True / False
function TrueFalseWidget({
  content,
  response,
  onChange,
}: {
  content: TrueFalseContent;
  response: boolean | null;
  onChange: (r: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <p className="text-base leading-relaxed">{content.stem}</p>
        <div className="flex gap-3">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange(val)}
              className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-all ${response === val ? 'border-primary bg-primary/5 text-primary' : 'border-muted hover:border-muted-foreground/50'}`}
            >
              {val ? 'True' : 'False'}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Short answer
function ShortAnswerWidget({
  content,
  response,
  onChange,
}: {
  content: ShortAnswerContent;
  response: string;
  onChange: (r: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <p className="text-base leading-relaxed">{content.stem}</p>
        <input
          type="text"
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Type your answer…"
          value={response ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}

// Essay
function EssayWidget({
  content,
  response,
  onChange,
}: {
  content: EssayContent;
  response: string;
  onChange: (r: unknown) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <p className="text-base leading-relaxed">{content.stem}</p>
        {content.rubric && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Grading guide</summary>
            <p className="mt-1 pl-2">{content.rubric}</p>
          </details>
        )}
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-32 resize-y"
          placeholder="Write your answer…"
          value={response ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
        {content.wordLimit && (
          <p className="text-xs text-muted-foreground">Word limit: {content.wordLimit}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Ordering
function OrderingWidget({
  content,
  response,
  onChange,
}: {
  content: OrderingContent;
  response: string[];
  onChange: (r: unknown) => void;
}) {
  const [order, setOrder] = useState<string[]>(() => {
    if (response && response.length > 0) return response;
    const ids = content.items.map((it) => it.id);
    return content.shuffle ? [...ids].sort(() => Math.random() - 0.5) : ids;
  });

  function moveItem(fromIdx: number, toIdx: number) {
    const next = [...order];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    setOrder(next);
    onChange(next);
  }

  const itemMap = Object.fromEntries(content.items.map((it) => [it.id, it.text]));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <p className="text-base leading-relaxed">{content.stem}</p>
        <p className="text-xs text-muted-foreground">
          Drag to reorder, or use the arrows to move items up and down.
        </p>
        <div className="flex flex-col gap-2">
          {order.map((id, i) => (
            <div
              key={id}
              className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background"
            >
              <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
              <span className="flex-1 text-sm">{itemMap[id]}</span>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => moveItem(i, i - 1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === order.length - 1}
                  onClick={() => moveItem(i, i + 1)}
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Matching
function MatchingWidget({
  content,
  response,
  onChange,
}: {
  content: MatchingContent;
  response: Record<string, string>;
  onChange: (r: unknown) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const matches = response ?? {};

  const rightItems = content.pairs.map((p) => p.right);
  const shuffledRight = useRef(
    [...rightItems].sort(() => (content.shuffleRight ? Math.random() - 0.5 : 0)),
  );

  function handleLeftClick(leftId: string) {
    setSelected(leftId === selected ? null : leftId);
  }

  function handleRightClick(rightId: string) {
    if (!selected) return;
    const next = { ...matches, [selected]: rightId };
    setSelected(null);
    onChange(next);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <p className="text-base leading-relaxed">{content.stem}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Click to select</p>
            {content.pairs.map((pair) => (
              <button
                key={pair.left.id}
                type="button"
                onClick={() => handleLeftClick(pair.left.id)}
                className={`px-3 py-2 rounded-md border-2 text-left text-sm transition-all ${selected === pair.left.id ? 'border-primary bg-primary/5' : matches[pair.left.id] ? 'border-green-400 bg-green-50' : 'border-muted hover:border-muted-foreground/50'}`}
              >
                {pair.left.text}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Click to match</p>
            {shuffledRight.current.map((right) => (
              <button
                key={right.id}
                type="button"
                onClick={() => handleRightClick(right.id)}
                disabled={!selected}
                className={`px-3 py-2 rounded-md border-2 text-left text-sm transition-all disabled:opacity-50 ${Object.values(matches).includes(right.id) ? 'border-green-400 bg-green-50' : 'border-muted hover:border-muted-foreground/50'}`}
              >
                {right.text}
              </button>
            ))}
          </div>
        </div>
        {selected && (
          <p className="text-xs text-primary">Now click a right-side item to match it</p>
        )}
      </CardContent>
    </Card>
  );
}

// Gap match
function GapMatchWidget({
  content,
  response,
  onChange,
}: {
  content: { stem: string; gaps: { id: string; answer: string }[] };
  response: Record<string, string>;
  onChange: (r: unknown) => void;
}) {
  const answers = response ?? {};

  // Split stem by _____ placeholder
  const parts = content.stem.split('_____');

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex flex-wrap items-center gap-1 text-base leading-relaxed">
          {parts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>{part}</span>
              {i < content.gaps.length && (
                <input
                  type="text"
                  className="inline-block border-b-2 border-primary bg-transparent text-center text-sm focus:outline-none min-w-20 mx-1"
                  value={answers[content.gaps[i].id] ?? ''}
                  onChange={(e) => {
                    const next = { ...answers, [content.gaps[i].id]: e.target.value };
                    onChange(next);
                  }}
                  placeholder="…"
                />
              )}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
