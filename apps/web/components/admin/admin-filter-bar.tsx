'use client';

import * as React from 'react';
import { SlidersHorizontal, Search, X, ChevronDown, Check } from 'lucide-react';
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
  CommandItem,
} from '@iconicedu/ui-web';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => unknown;
}

export interface AdminFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterGroups?: FilterGroup[];
  extraFilters?: React.ReactNode;
  extraActiveCount?: number;
  onClearExtraFilters?: () => void;
  layout?: 'responsive' | 'grid' | 'toolbar';
  embedded?: boolean;
  filterTitle?: string;
  filterDescription?: string;
}

// ─── Breakpoints ──────────────────────────────────────────────────────────────

const BP = { sm: 640, md: 768, lg: 1024 } as const;

function useWindowWidth() {
  const [width, setWidth] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : BP.lg,
  );
  React.useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

// ─── FilterDropdown (inline) ──────────────────────────────────────────────────

export function FilterDropdown({
  group,
  fullWidth = false,
}: {
  group: FilterGroup;
  fullWidth?: boolean;
}) {
  const isActive = group.value !== group.options[0]?.value;
  const selectedLabel =
    group.options.find((o) => o.value === group.value)?.label ?? group.options[0]?.label;

  return (
    <div
      className={
        fullWidth
          ? 'flex min-w-0 flex-col items-stretch gap-2'
          : 'flex shrink-0 items-center gap-1.5'
      }
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {group.label}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`${fullWidth ? 'min-w-0 flex-1 justify-between px-3' : ''} gap-1.5 ${isActive ? 'border-primary/40 bg-primary/5 font-semibold' : ''}`}
            >
              <span className="truncate">{selectedLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={
              fullWidth
                ? 'w-[var(--radix-popover-trigger-width)] min-w-56 p-0'
                : 'w-44 p-0'
            }
            align="start"
          >
            <Command>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {group.options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => group.onChange(opt.value)}
                    className="gap-2.5"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        group.value === opt.value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background'
                      }`}
                    >
                      {group.value === opt.value && <Check className="h-2.5 w-2.5" />}
                    </span>
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => group.onChange(group.options[0]?.value ?? 'all')}
            aria-label={`Clear ${group.label}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── FilterDialogGroup (inside More filters dialog) ───────────────────────────

function FilterDialogGroup({ group }: { group: FilterGroup }) {
  const isActive = group.value !== group.options[0]?.value;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {group.label}
        </Label>
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-0 px-1 text-xs text-muted-foreground"
            onClick={() => group.onChange(group.options[0]?.value ?? 'all')}
          >
            Clear
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {group.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => group.onChange(opt.value)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              group.value === opt.value
                ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                : 'bg-background text-muted-foreground hover:bg-accent'
            }`}
          >
            {group.value === opt.value && <Check className="h-3 w-3 shrink-0" />}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── AdminFilterBar ───────────────────────────────────────────────────────────

export function AdminFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search ...',
  filterGroups = [],
  extraFilters,
  extraActiveCount = 0,
  onClearExtraFilters,
  layout = 'responsive',
  embedded = false,
  filterTitle = 'Filters',
  filterDescription = 'Narrow the current results.',
}: AdminFilterBarProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const width = useWindowWidth();

  // Show more groups as screen gets wider
  const visibleCount =
    width >= BP.lg
      ? filterGroups.length
      : width >= BP.md
        ? Math.min(filterGroups.length, 2)
        : width >= BP.sm
          ? Math.min(filterGroups.length, 1)
          : 0;

  const visibleGroups = filterGroups.slice(0, visibleCount);
  const hiddenGroups = filterGroups.slice(visibleCount);
  const anyHidden = hiddenGroups.length > 0;
  const activeHiddenCount = hiddenGroups.filter(
    (g) => g.value !== g.options[0]?.value,
  ).length;

  if (layout === 'grid') {
    return (
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search
            </span>
            <span className="flex h-9 min-w-0 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </span>
          </label>
          {filterGroups.map((group) => (
            <FilterDropdown key={group.label} group={group} fullWidth />
          ))}
          {extraFilters && <div className="min-w-0">{extraFilters}</div>}
        </div>
      </div>
    );
  }

  if (layout === 'toolbar') {
    const activeCount =
      filterGroups.filter((group) => group.value !== group.options[0]?.value).length +
      extraActiveCount;
    const hasFilters = filterGroups.length > 0 || Boolean(extraFilters);
    return (
      <div
        className={`${embedded ? '' : 'rounded-xl border bg-card p-3'} flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end`}
      >
        <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring sm:w-64">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="sr-only">Search</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        {hasFilters && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="justify-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {activeCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(42rem,calc(100vw-2rem))] gap-5 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{filterTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filterDescription}
                  </p>
                </div>
                {activeCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      filterGroups.forEach((group) =>
                        group.onChange(group.options[0]?.value ?? 'all'),
                      );
                      onClearExtraFilters?.();
                    }}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              {filterGroups.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filterGroups.map((group) => (
                    <FilterDropdown key={group.label} group={group} fullWidth />
                  ))}
                </div>
              )}
              {extraFilters && (
                <div className={filterGroups.length > 0 ? 'border-t pt-4' : ''}>
                  {extraFilters}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search
            </span>
            <div className="flex items-center gap-2 h-9 w-44 sm:w-52 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          {/* Visible filter groups */}
          {visibleGroups.map((group) => (
            <FilterDropdown key={group.label} group={group} />
          ))}

          {/* Extra filters — always visible */}
          {extraFilters && <div className="flex items-center gap-2">{extraFilters}</div>}

          {/* Right side: more filters */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 transition-opacity ${anyHidden ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setDialogOpen(true)}
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

      {/* More filters dialog */}
      {filterGroups.length > 0 && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>More filters</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-2">
              {hiddenGroups.map((group) => (
                <FilterDialogGroup key={group.label} group={group} />
              ))}
            </div>
            {activeHiddenCount > 0 && (
              <div className="border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    hiddenGroups.forEach((g) => g.onChange(g.options[0]?.value ?? 'all'));
                    setDialogOpen(false);
                  }}
                >
                  Clear these filters
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
