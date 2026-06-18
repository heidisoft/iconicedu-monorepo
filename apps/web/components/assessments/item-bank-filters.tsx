'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { AssessmentSubjectVM } from '@iconicedu/shared-types';
import {
  Badge,
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
import { Check, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';

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

// Tailwind breakpoints — must match tailwind.config
const BP = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

function parseParam(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}

// ─── useWindowWidth ───────────────────────────────────────────────────────────

function useWindowWidth() {
  // Default to large screen on SSR to avoid flash of collapsed state on desktop
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
  const [open, setOpen] = useState(false);
  const isActive = selected.length > 0;

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  if (inline) {
    return (
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
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

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? 'border-primary/40 bg-primary/5 text-foreground'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <span className="font-medium">{allLabel}</span>
            <Badge
              variant="secondary"
              className={`h-4 min-w-4 px-1 text-[10px] font-semibold transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {selected.length}
            </Badge>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
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
                  >
                    <Check
                      className={`mr-2 h-4 w-4 shrink-0 transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
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

  // Each filter appears on the bar at a specific minimum width.
  // They collapse one-by-one as the window shrinks.
  const hasSubjects = subjects.length > 0;
  const show = {
    type: width >= BP.sm, // 640px
    grade: width >= BP.md, // 768px
    difficulty: width >= BP.lg, // 1024px
    subject: width >= BP.xl && hasSubjects, // 1280px
  };
  const hiddenCount =
    Object.values(show).filter((v) => !v).length - (hasSubjects ? 0 : 1); // don't count subject if there are none

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

  const anyHidden =
    !show.type || !show.grade || !show.difficulty || (hasSubjects && !show.subject);

  const [searchValue, setSearchValue] = useState(urlSearch);
  useEffect(() => {
    setSearchValue(urlSearch);
  }, [urlSearch]);

  const buildUrl = useCallback(
    (updates: Record<string, string[]>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, values] of Object.entries(updates)) {
        if (values.length > 0) params.set(key, values.join(','));
        else params.delete(key);
      }
      params.delete('page');
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  function updateMulti(key: string, values: string[]) {
    startTransition(() => router.replace(buildUrl({ [key]: values })));
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
        <div className="flex items-center gap-4">
          {/* Search — always visible */}
          <div className="flex items-center gap-2.5 shrink-0">
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

          {/* Type — shows at sm+ */}
          {show.type && (
            <MultiSelect
              label="Type"
              allLabel="All types"
              options={ITEM_TYPES}
              selected={current.types}
              onChange={(v) => updateMulti('types', v)}
            />
          )}

          {/* Grade — shows at md+ */}
          {show.grade && (
            <MultiSelect
              label="Grade"
              allLabel="All"
              options={GRADES}
              selected={current.grades}
              onChange={(v) => updateMulti('grades', v)}
            />
          )}

          {/* Difficulty — shows at lg+ */}
          {show.difficulty && (
            <MultiSelect
              label="Difficulty"
              allLabel="All"
              options={DIFFICULTIES}
              selected={current.difficulties}
              onChange={(v) => updateMulti('difficulties', v)}
            />
          )}

          {/* Subject — shows at xl+ */}
          {show.subject && (
            <MultiSelect
              label="Subject"
              allLabel="All"
              options={subjectOptions}
              selected={current.subjectIds}
              onChange={(v) => updateMulti('subjectIds', v)}
            />
          )}

          {/* More filters button — always rendered to reserve space, invisible when nothing is hidden */}
          <div className="ml-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              className={`h-9 gap-2 transition-opacity ${anyHidden ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setMobileOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              More filters
              <Badge
                variant={activeHiddenCount > 0 ? 'default' : 'secondary'}
                className={`h-4 min-w-4 px-1 text-[10px] font-semibold transition-opacity ${
                  activeHiddenCount > 0 ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {activeHiddenCount}
              </Badge>
            </Button>
          </div>
        </div>
      </div>

      {/* More filters dialog — only contains filters not shown in the bar */}
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
