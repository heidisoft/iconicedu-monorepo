'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { AssessmentSubjectVM } from '@iconicedu/shared-types';
import { Button, Label } from '@iconicedu/ui-web';
import { Check } from 'lucide-react';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';

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
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const isActive = selected.length > 0;

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

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

// ─── ItemBankFilters ──────────────────────────────────────────────────────────

interface Props {
  subjects: AssessmentSubjectVM[];
}

/**
 * URL-synced wrapper around {@link AdminFilterBar} for the item bank. The
 * multi-select facets live in the shared filter bar's `extraFilters` slot so
 * the whole admin area uses one filter component.
 */
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
    <AdminFilterBar
      layout="toolbar"
      search={searchValue}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Search questions"
      filterTitle="Filter question bank"
      filterDescription="Combine filters to narrow the current results."
      extraActiveCount={activeFilterCount}
      onClearExtraFilters={clearFilters}
      extraFilters={
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <MultiSelect
            label="Type"
            options={ITEM_TYPES}
            selected={current.types}
            onChange={(values) => updateMulti('types', values)}
          />
          <MultiSelect
            label="Grade"
            options={GRADES}
            selected={current.grades}
            onChange={(values) => updateMulti('grades', values)}
          />
          <MultiSelect
            label="Difficulty"
            options={DIFFICULTIES}
            selected={current.difficulties}
            onChange={(values) => updateMulti('difficulties', values)}
          />
          {hasSubjects && (
            <MultiSelect
              label="Subject"
              options={subjectOptions}
              selected={current.subjectIds}
              onChange={(values) => updateMulti('subjectIds', values)}
            />
          )}
        </div>
      }
    />
  );
}
