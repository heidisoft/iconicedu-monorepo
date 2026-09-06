'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { ChevronRight, GripVertical, Check, ChevronUp, ChevronDown } from 'lucide-react';

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
  const [questionKey, setQuestionKey] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setResponse(null);
    setQuestionKey((k) => k + 1);
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
    <>
      <style>{`
        @keyframes qFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .question-enter { animation: qFadeIn 0.28s cubic-bezier(0.16,1,0.3,1) both; }

        @keyframes mcqPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
        .mcq-select { animation: mcqPop 0.18s ease forwards; }

        @keyframes dropBounce {
          0%   { transform: translateY(-4px); }
          60%  { transform: translateY(2px); }
          100% { transform: translateY(0); }
        }
        .drop-bounce { animation: dropBounce 0.22s ease both; }
      `}</style>

      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Question {state.itemsAnswered + 1}
              {state.itemsTotal ? ` of ${state.itemsTotal}` : ''}
            </span>
            {state.adaptiveNote && (
              <span className="text-blue-500 italic text-xs">{state.adaptiveNote}</span>
            )}
            {progress !== null && <span className="tabular-nums">{progress}%</span>}
          </div>
          <div
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={progress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Assessment progress"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${progress ?? 0}%`,
                transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
        </div>

        {/* Item metadata */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs font-medium">
            {currentItem.skillName}
          </Badge>
          {currentItem.subjectName && (
            <span className="text-xs text-muted-foreground">
              {currentItem.subjectName}
            </span>
          )}
          <div
            className="flex gap-0.5 ml-auto"
            title={`Difficulty: ${currentItem.difficulty} out of 5`}
            aria-label={`Difficulty ${currentItem.difficulty} out of 5`}
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <div
                key={d}
                className={`h-2 w-2 rounded-full transition-colors ${
                  d <= currentItem.difficulty ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Question — animated on change */}
        <div key={questionKey} className="question-enter">
          <ItemResponseWidget
            item={currentItem}
            response={response}
            onChange={setResponse}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-end">
          {state.isComplete ? (
            <Button onClick={handleComplete} disabled={completing} size="lg">
              {completing ? 'Finishing…' : 'See Results'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={submitting || !answered}
              size="lg"
              className="min-w-28"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
                    aria-hidden
                  />
                  Saving…
                </span>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </>
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

// ──────────────────────────────────────────────────────────────────────────────
// MCQ / Multiple response
// ──────────────────────────────────────────────────────────────────────────────

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
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const selectedIds = multiple
    ? ((response as string[]) ?? [])
    : response
      ? [response as string]
      : [];

  function toggle(optionId: string) {
    setLastSelected(optionId);
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
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-5 py-6">
        <p className="text-base leading-relaxed font-medium">{content.stem}</p>
        {multiple && (
          <p className="text-xs text-muted-foreground -mt-2">Select all that apply</p>
        )}
        <div
          className="flex flex-col gap-2.5"
          role={multiple ? 'group' : 'radiogroup'}
          aria-label="Answer options"
        >
          {content.options.map((opt, i) => {
            const isSelected = selectedIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                role={multiple ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                onClick={() => toggle(opt.id)}
                className={[
                  'flex items-center gap-3.5 w-full px-4 py-3.5 rounded-xl border-2 text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  'transition-all duration-150',
                  isSelected
                    ? 'border-primary bg-primary/8 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40 active:scale-[0.99]',
                  lastSelected === opt.id ? 'mcq-select' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex-shrink-0 h-7 w-7 flex items-center justify-center text-xs font-semibold',
                    'border-2 transition-all duration-150',
                    multiple ? 'rounded-md' : 'rounded-full',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30 text-muted-foreground',
                  ].join(' ')}
                  aria-hidden
                >
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                <span className="text-sm leading-snug">{opt.text}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// True / False
// ──────────────────────────────────────────────────────────────────────────────

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
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-6 py-6">
        <p className="text-base leading-relaxed font-medium">{content.stem}</p>
        <div
          className="grid grid-cols-2 gap-3"
          role="radiogroup"
          aria-label="True or False"
        >
          {([true, false] as const).map((val) => {
            const isSelected = response === val;
            return (
              <button
                key={String(val)}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange(val)}
                className={[
                  'py-5 rounded-xl border-2 text-base font-semibold',
                  'transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  isSelected
                    ? val
                      ? 'border-success bg-success/10 text-success shadow-sm'
                      : 'border-destructive bg-destructive/10 text-destructive shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/40 active:scale-[0.98] text-foreground',
                ].join(' ')}
              >
                <span className="flex items-center justify-center gap-2">
                  {isSelected && (
                    <Check
                      className="h-4 w-4 flex-shrink-0"
                      strokeWidth={3}
                      aria-hidden
                    />
                  )}
                  {val ? 'True' : 'False'}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Short answer
// ──────────────────────────────────────────────────────────────────────────────

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
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-5 py-6">
        <p className="text-base leading-relaxed font-medium">{content.stem}</p>
        <input
          type="text"
          className={[
            'w-full border-2 border-border rounded-lg px-4 py-3 text-sm',
            'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
            'transition-all duration-150 placeholder:text-muted-foreground/60',
          ].join(' ')}
          placeholder="Type your answer…"
          value={response ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Your answer"
        />
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Essay
// ──────────────────────────────────────────────────────────────────────────────

function EssayWidget({
  content,
  response,
  onChange,
}: {
  content: EssayContent;
  response: string;
  onChange: (r: unknown) => void;
}) {
  const wordCount = (response ?? '').trim().split(/\s+/).filter(Boolean).length;
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-5 py-6">
        <p className="text-base leading-relaxed font-medium">{content.stem}</p>
        {content.rubric && (
          <details className="text-xs text-muted-foreground border rounded-lg px-3 py-2">
            <summary className="cursor-pointer font-medium select-none">
              Grading guide
            </summary>
            <p className="mt-2 leading-relaxed">{content.rubric}</p>
          </details>
        )}
        <textarea
          className={[
            'w-full border-2 border-border rounded-lg px-4 py-3 text-sm leading-relaxed',
            'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
            'transition-all duration-150 placeholder:text-muted-foreground/60',
            'min-h-36 resize-y',
          ].join(' ')}
          placeholder="Write your answer here…"
          value={response ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Essay answer"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {wordCount} word{wordCount !== 1 ? 's' : ''}
          </span>
          {content.wordLimit && <span>Limit: {content.wordLimit} words</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ordering — full drag-and-drop with visual feedback
// ──────────────────────────────────────────────────────────────────────────────

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
    if (Array.isArray(response) && response.length > 0) return response;
    const ids = content.items.map((it) => it.id);
    return content.shuffle ? [...ids].sort(() => Math.random() - 0.5) : ids;
  });

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [justDropped, setJustDropped] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const itemMap = Object.fromEntries(content.items.map((it) => [it.id, it.text]));

  function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const next = [...order];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setOrder(next);
    onChange(next);
    return toIdx;
  }

  function moveItem(fromIdx: number, toIdx: number) {
    const landed = reorder(fromIdx, toIdx);
    if (landed !== undefined) {
      setJustDropped(landed);
      setTimeout(() => setJustDropped(null), 300);
    }
  }

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, idx: number) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = 'move';
      // Slight delay so browser can render the ghost image before we style the element
      requestAnimationFrame(() => {
        dragNode.current?.setAttribute('data-dragging', 'true');
      });
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (idx !== dragIdx) setOverIdx(idx);
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, toIdx: number) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === toIdx) {
        setDragIdx(null);
        setOverIdx(null);
        return;
      }
      moveItem(dragIdx, toIdx);
      setDragIdx(null);
      setOverIdx(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragIdx, order],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-5 py-6">
        <p className="text-base leading-relaxed font-medium">{content.stem}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
          Drag to reorder, or use the arrows for keyboard navigation.
        </p>

        <div className="flex flex-col gap-2" role="list" aria-label="Items to order">
          {order.map((id, i) => {
            const isDragging = dragIdx === i;
            const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
            const isDropped = justDropped === i;

            return (
              <div
                key={id}
                ref={isDragging ? dragNode : null}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                role="listitem"
                aria-label={`Position ${i + 1}: ${itemMap[id]}`}
                className={[
                  'flex items-center gap-3 rounded-xl border-2 px-3 py-3',
                  'transition-all duration-150 select-none',
                  isDragging
                    ? 'opacity-40 border-primary/50 bg-primary/5 scale-[0.98] shadow-none cursor-grabbing'
                    : isOver
                      ? 'border-primary bg-primary/8 shadow-md scale-[1.01] cursor-copy'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30 cursor-grab active:cursor-grabbing',
                  isDropped ? 'drop-bounce' : '',
                ].join(' ')}
              >
                {/* Drag handle */}
                <GripVertical
                  className={`h-4 w-4 flex-shrink-0 transition-colors ${
                    isDragging ? 'text-primary' : 'text-muted-foreground/50'
                  }`}
                  aria-hidden
                />

                {/* Position badge */}
                <span
                  className={[
                    'flex-shrink-0 h-6 w-6 rounded-full text-xs font-semibold',
                    'flex items-center justify-center transition-all duration-200',
                    isOver
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                  aria-hidden
                >
                  {i + 1}
                </span>

                {/* Text */}
                <span className="flex-1 text-sm leading-snug">{itemMap[id]}</span>

                {/* Arrow buttons */}
                <div
                  className="flex flex-col gap-0.5"
                  role="group"
                  aria-label={`Move "${itemMap[id]}"`}
                >
                  <button
                    type="button"
                    className={[
                      'h-6 w-6 rounded flex items-center justify-center',
                      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      i === 0
                        ? 'text-muted-foreground/20 cursor-default'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    ].join(' ')}
                    disabled={i === 0}
                    aria-label={`Move "${itemMap[id]}" up`}
                    onClick={() => moveItem(i, i - 1)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className={[
                      'h-6 w-6 rounded flex items-center justify-center',
                      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      i === order.length - 1
                        ? 'text-muted-foreground/20 cursor-default'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    ].join(' ')}
                    disabled={i === order.length - 1}
                    aria-label={`Move "${itemMap[id]}" down`}
                    onClick={() => moveItem(i, i + 1)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Drop indicator strip shown during drag */}
        {dragIdx !== null && (
          <p
            className="text-xs text-primary text-center animate-pulse"
            aria-live="polite"
          >
            Drop over a position to move the item there
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Matching
// ──────────────────────────────────────────────────────────────────────────────

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
  const matches =
    response !== null && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, string>)
      : {};

  const rightItems = content.pairs.map((p) => p.right);
  const shuffledRight = useRef(
    [...rightItems].sort(() => (content.shuffleRight ? Math.random() - 0.5 : 0)),
  );

  const matchedPairs = Object.entries(matches).length;
  const totalPairs = content.pairs.length;

  function handleLeftClick(leftId: string) {
    setSelected(leftId === selected ? null : leftId);
  }

  function handleRightClick(rightId: string) {
    if (!selected) return;
    const next = { ...matches, [selected]: rightId };
    setSelected(null);
    onChange(next);
  }

  function clearMatch(leftId: string) {
    const next = { ...matches };
    delete next[leftId];
    onChange(next);
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-5 py-6">
        <p className="text-base leading-relaxed font-medium">{content.stem}</p>

        {matchedPairs > 0 && (
          <p className="text-xs text-muted-foreground">
            {matchedPairs} of {totalPairs} matched
          </p>
        )}

        {selected && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/30 text-xs text-primary">
            <span
              className="h-2 w-2 rounded-full bg-primary animate-pulse flex-shrink-0"
              aria-hidden
            />
            Now click a right-side item to match it
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {selected ? 'Selected ↓' : 'Click to select'}
            </p>
            {content.pairs.map((pair) => {
              const isSelected = selected === pair.left.id;
              const isMatched = !!matches[pair.left.id];
              return (
                <div key={pair.left.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLeftClick(pair.left.id)}
                    className={[
                      'flex-1 px-3 py-2.5 rounded-lg border-2 text-left text-sm',
                      'transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                      isSelected
                        ? 'border-primary bg-primary/8 shadow-sm font-medium'
                        : isMatched
                          ? 'border-success bg-success/10 text-success'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30',
                    ].join(' ')}
                    aria-pressed={isSelected}
                    aria-label={`Left item: ${pair.left.text}${isMatched ? ' (matched)' : ''}`}
                  >
                    {pair.left.text}
                  </button>
                  {isMatched && (
                    <button
                      type="button"
                      onClick={() => clearMatch(pair.left.id)}
                      className="h-5 w-5 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-xs transition-colors flex-shrink-0"
                      aria-label={`Remove match for ${pair.left.text}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Click to match
            </p>
            {shuffledRight.current.map((right) => {
              const isUsed = Object.values(matches).includes(right.id);
              return (
                <button
                  key={right.id}
                  type="button"
                  onClick={() => handleRightClick(right.id)}
                  disabled={!selected && !isUsed}
                  className={[
                    'px-3 py-2.5 rounded-lg border-2 text-left text-sm',
                    'transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                    isUsed
                      ? 'border-success bg-success/10 text-success cursor-default'
                      : selected
                        ? 'border-primary/40 hover:border-primary hover:bg-primary/8 hover:shadow-sm cursor-pointer'
                        : 'border-border opacity-60 cursor-default',
                  ].join(' ')}
                  aria-label={`Right item: ${right.text}${isUsed ? ' (already matched)' : ''}`}
                >
                  {right.text}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Gap match
// ──────────────────────────────────────────────────────────────────────────────

function GapMatchWidget({
  content,
  response,
  onChange,
}: {
  content: { stem: string; gaps: { id: string; answer: string }[] };
  response: Record<string, string>;
  onChange: (r: unknown) => void;
}) {
  const answers =
    response !== null && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, string>)
      : {};
  const parts = content.stem.split('_____');

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="text-sm leading-loose">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < content.gaps.length && (
                <input
                  type="text"
                  className={[
                    'inline-block border-b-2 border-primary bg-transparent text-center text-sm',
                    'focus:outline-none focus:border-primary/80 transition-colors',
                    'min-w-24 mx-1.5 pb-0.5',
                  ].join(' ')}
                  value={answers[content.gaps[i].id] ?? ''}
                  onChange={(e) => {
                    const next = { ...answers, [content.gaps[i].id]: e.target.value };
                    onChange(next);
                  }}
                  placeholder="…"
                  aria-label={`Gap ${i + 1}`}
                />
              )}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
