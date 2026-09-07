'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { AssessmentSubjectVM } from '@iconicedu/shared-types';
import {
  Button,
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

function parseParam(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
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
  const hasSubjects = subjects.length > 0;

  const urlSearch = searchParams.get('search') ?? '';
  const current = {
    subjectIds: parseParam(searchParams.get('subjectIds')),
    grades: parseParam(searchParams.get('grades')),
    types: parseParam(searchParams.get('types')),
    difficulties: parseParam(searchParams.get('difficulties')),
  };

  const activeFilterCount = [
    current.types,
    current.grades,
    current.difficulties,
    current.subjectIds,
  ].filter((values) => values.length > 0).length;

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

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    ['types', 'grades', 'difficulties', 'subjectIds'].forEach((key) =>
      params.delete(key),
    );
    params.delete('page');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-end">
      <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring sm:w-64">
        <span className="sr-only">Search</span>
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          placeholder="Search questions"
          value={searchValue}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
      </label>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(42rem,calc(100vw-2rem))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Filter question bank</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Combine filters to narrow the current results.
              </p>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <MultiSelect
              label="Type"
              allLabel="All types"
              options={ITEM_TYPES}
              selected={current.types}
              onChange={(values) => updateMulti('types', values)}
              inline
            />
            <MultiSelect
              label="Grade"
              allLabel="All grades"
              options={GRADES}
              selected={current.grades}
              onChange={(values) => updateMulti('grades', values)}
              inline
            />
            <MultiSelect
              label="Difficulty"
              allLabel="All difficulties"
              options={DIFFICULTIES}
              selected={current.difficulties}
              onChange={(values) => updateMulti('difficulties', values)}
              inline
            />
            {hasSubjects && (
              <MultiSelect
                label="Subject"
                allLabel="All subjects"
                options={subjectOptions}
                selected={current.subjectIds}
                onChange={(values) => updateMulti('subjectIds', values)}
                inline
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
