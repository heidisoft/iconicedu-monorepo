'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';

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

/**
 * URL-synced wrapper around {@link AdminFilterBar} used by the assessments
 * list pages. Keeps the single shared admin filter component/visual while
 * driving state through search params instead of React state.
 */
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
    <AdminFilterBar
      layout="toolbar"
      search={searchValue}
      onSearchChange={handleSearchChange}
      searchPlaceholder={searchPlaceholder}
      filterGroups={filters.map((filter) => ({
        label: filter.label,
        value: searchParams.get(filter.key) ?? 'all',
        onChange: (value) => updateParam(filter.key, value === 'all' ? null : value),
        options: [{ value: 'all', label: 'All' }, ...filter.options],
      }))}
    />
  );
}
