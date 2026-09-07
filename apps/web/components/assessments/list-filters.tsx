'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface Props {
  filters?: FilterConfig[];
  searchPlaceholder?: string;
}

export function ListFilters({ filters = [], searchPlaceholder = 'Search…' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlSearch = searchParams.get('search') ?? '';
  const [searchValue, setSearchValue] = useState(urlSearch);
  useEffect(() => {
    setSearchValue(urlSearch);
  }, [urlSearch]);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam('search', value || null), 300);
  }

  const activeFilterCount = filters.filter((filter) =>
    searchParams.has(filter.key),
  ).length;

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    filters.forEach((filter) => params.delete(filter.key));
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
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </label>

      {filters.length > 0 && (
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
                <p className="font-semibold">Filters</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Narrow the current results.
                </p>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {filters.map((filter) => {
                const current = searchParams.get(filter.key);
                return (
                  <div key={filter.key} className="min-w-0 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {filter.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {filter.options.map((option) => {
                        const active = current === option.value;
                        return (
                          <Button
                            key={option.value}
                            variant={active ? 'default' : 'outline'}
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                              updateParam(filter.key, active ? null : option.value)
                            }
                          >
                            {active && <Check className="h-3 w-3" />}
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
