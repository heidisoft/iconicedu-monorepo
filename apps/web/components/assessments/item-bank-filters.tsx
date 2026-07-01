'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { AssessmentSubjectVM } from '@iconicedu/shared-types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@iconicedu/ui-web';
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';

// ─── constants ────────────────────────────────────────────────────────────────

const ITEM_TYPES = [
  { value: 'multiple_choice', label: 'MCQ' },
  { value: 'multiple_response', label: 'Multi-select' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'matching', label: 'Matching' },
  { value: 'gap_match', label: 'Fill-in-blank' },
];

const DIFFICULTIES = [
  { value: '1', label: 'Beginner' },
  { value: '2', label: 'Easy' },
  { value: '3', label: 'Medium' },
  { value: '4', label: 'Hard' },
  { value: '5', label: 'Expert' },
];

const GRADES = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Grade ${i + 1}`,
}));

const BP = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

function parseParam(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}

// ─── useWindowWidth ───────────────────────────────────────────────────────────

function useWindowWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : BP.xl,
  );
  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

// ─── MultiSelect ──────────────────────────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  inline?: boolean;
}

function MultiSelect({
  label,
  allLabel,
  options,
  selected,
  onChange,
  inline,
}: MultiSelectProps) {
  const isActive = selected.length > 0;

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  // ── Inline variant — inside "More filters" dialog ──────────────────────────
  if (inline) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </Label>
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-xs text-muted-foreground"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  checked
                    ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                    : 'bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                {checked && <Check className="h-3 w-3 shrink-0" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Popover variant — in the filter bar ────────────────────────────────────
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={isActive ? 'border-primary/40 bg-primary/5 font-semibold' : ''}
          >
            {isActive ? selected.length : allLabel}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command>
            {options.length > 6 && <CommandInput placeholder="Search…" />}
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => toggle(opt.value)}
                    className="data-selected:bg-transparent gap-2.5"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background'
                      }`}
                    >
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onChange([])}
          aria-label={`Clear ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── ItemBankFilters ──────────────────────────────────────────────────────────

interface Props {
  subjects: AssessmentSubjectVM[];
}

export function ItemBankFilters({ subjects }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const width = useWindowWidth();

  const hasSubjects = subjects.length > 0;
  const show = {
    type: width >= BP.sm,
    grade: width >= BP.md,
    difficulty: width >= BP.lg,
    subject: width >= BP.xl && hasSubjects,
  };
  const anyHidden =
    !show.type || !show.grade || !show.difficulty || (hasSubjects && !show.subject);

  const urlSearch = searchParams.get('search') ?? '';
  const current = {
    subjectIds: parseParam(searchParams.get('subjectIds')),
    grades: parseParam(searchParams.get('grades')),
    types: parseParam(searchParams.get('types')),
    difficulties: parseParam(searchParams.get('difficulties')),
  };

  const activeHiddenCount =
    (!show.type ? current.types.length : 0) +
    (!show.grade ? current.grades.length : 0) +
    (!show.difficulty ? current.difficulties.length : 0) +
    (!show.subject ? current.subjectIds.length : 0);

  const [searchValue, setSearchValue] = useState(urlSearch);
  useEffect(() => {
    setSearchValue(urlSearch);
  }, [urlSearch]);

  function updateMulti(key: string, values: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length > 0) params.set(key, values.join(','));
    else params.delete(key);
    params.delete('page');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set('search', value);
      else params.delete('search');
      params.delete('page');
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);
  }

  const subjectOptions = subjects.map((s) => ({
    value: s.id,
    label: s.icon ? `${s.icon} ${s.name}` : s.name,
  }));

  return (
    <>
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Search — always visible */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search
            </span>
            <div className="flex items-center gap-2 h-9 w-44 sm:w-56 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                placeholder="Search…"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>

          {show.type && (
            <MultiSelect
              label="Type"
              allLabel="All types"
              options={ITEM_TYPES}
              selected={current.types}
              onChange={(v) => updateMulti('types', v)}
            />
          )}
          {show.grade && (
            <MultiSelect
              label="Grade"
              allLabel="All"
              options={GRADES}
              selected={current.grades}
              onChange={(v) => updateMulti('grades', v)}
            />
          )}
          {show.difficulty && (
            <MultiSelect
              label="Difficulty"
              allLabel="All"
              options={DIFFICULTIES}
              selected={current.difficulties}
              onChange={(v) => updateMulti('difficulties', v)}
            />
          )}
          {show.subject && (
            <MultiSelect
              label="Subject"
              allLabel="All"
              options={subjectOptions}
              selected={current.subjectIds}
              onChange={(v) => updateMulti('subjectIds', v)}
            />
          )}

          {/* More filters — always rendered; invisible when nothing is hidden */}
          <div className="ml-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 transition-opacity ${anyHidden ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setMobileOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              More filters
              {activeHiddenCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {activeHiddenCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* More filters dialog — only hidden filters */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>More filters</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">
            {!show.type && (
              <MultiSelect
                label="Type"
                allLabel="All types"
                options={ITEM_TYPES}
                selected={current.types}
                onChange={(v) => updateMulti('types', v)}
                inline
              />
            )}
            {!show.grade && (
              <MultiSelect
                label="Grade"
                allLabel="All"
                options={GRADES}
                selected={current.grades}
                onChange={(v) => updateMulti('grades', v)}
                inline
              />
            )}
            {!show.difficulty && (
              <MultiSelect
                label="Difficulty"
                allLabel="All"
                options={DIFFICULTIES}
                selected={current.difficulties}
                onChange={(v) => updateMulti('difficulties', v)}
                inline
              />
            )}
            {!show.subject && hasSubjects && (
              <MultiSelect
                label="Subject"
                allLabel="All"
                options={subjectOptions}
                selected={current.subjectIds}
                onChange={(v) => updateMulti('subjectIds', v)}
                inline
              />
            )}
          </div>
          {activeHiddenCount > 0 && (
            <div className="border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (!show.type) params.delete('types');
                  if (!show.grade) params.delete('grades');
                  if (!show.difficulty) params.delete('difficulties');
                  if (!show.subject) params.delete('subjectIds');
                  startTransition(() =>
                    router.replace(`${pathname}?${params.toString()}`),
                  );
                  setMobileOpen(false);
                }}
              >
                Clear these filters
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
