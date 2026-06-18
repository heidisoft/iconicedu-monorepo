'use client';

import * as React from 'react';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
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

// ─── PillGroup (inline) ───────────────────────────────────────────────────────

function PillGroup({ group }: { group: FilterGroup }) {
  const isActive = group.value !== group.options[0]?.value;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {group.label}
      </span>
      <div className="flex items-center gap-1">
        {group.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`h-8 rounded-md px-3 text-sm font-medium border transition-colors ${
              group.value === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
            onClick={() => group.onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
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
    </div>
  );
}

// ─── PillGroupDialog (inside More filters dialog) ─────────────────────────────

function PillGroupDialog({ group }: { group: FilterGroup }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {group.label}
      </Label>
      <div className="flex flex-wrap gap-1">
        {group.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`h-8 rounded-md px-3 text-sm font-medium border transition-colors ${
              group.value === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
            onClick={() => group.onChange(opt.value)}
          >
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
            <PillGroup key={group.label} group={group} />
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
                <PillGroupDialog key={group.label} group={group} />
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
