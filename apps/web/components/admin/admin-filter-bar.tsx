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

function FilterDropdown({ group }: { group: FilterGroup }) {
  const isActive = group.value !== group.options[0]?.value;
  const selectedLabel =
    group.options.find((o) => o.value === group.value)?.label ?? group.options[0]?.label;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {group.label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 ${isActive ? 'border-primary/40 bg-primary/5 font-semibold' : ''}`}
          >
            {selectedLabel}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-0" align="start">
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
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => group.onChange(group.options[0]?.value ?? 'all')}
          aria-label={`Clear ${group.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
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
