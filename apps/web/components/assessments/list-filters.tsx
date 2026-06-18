'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@iconicedu/ui-web';
import { Search, X } from 'lucide-react';

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

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 h-9 w-52 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring shrink-0">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Categorical pill filters */}
        {filters.map((filter) => {
          const current = searchParams.get(filter.key);
          return (
            <div key={filter.key} className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {filter.label}
              </span>
              <div className="flex items-center gap-1">
                {filter.options.map((opt) => {
                  const active = current === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => updateParam(filter.key, active ? null : opt.value)}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
                {current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => updateParam(filter.key, null)}
                    aria-label={`Clear ${filter.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
