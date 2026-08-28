import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { FilterIcon, RefreshIcon, SearchIcon } from '@/components/icons';
import type { Sender } from '@repo/shared';

export interface TopBarFilters {
  senderId: string | null;
  starredOnly: boolean;
}

export interface TopBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: TopBarFilters;
  onFiltersChange: (filters: TopBarFilters) => void;
  senders: Sender[];
  onRefresh: () => void;
  refreshing: boolean;
}

export function TopBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  senders,
  onRefresh,
  refreshing,
}: TopBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [filterOpen]);

  const filterCount = (filters.senderId ? 1 : 0) + (filters.starredOnly ? 1 : 0);

  return (
    <div className="flex items-center gap-3 border-b border-line bg-white px-6 py-3">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          aria-label="Search emails"
          className="h-11 w-full rounded-full bg-field pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div ref={filterRef} className="relative">
        <button
          onClick={() => setFilterOpen((v) => !v)}
          aria-label="Filter"
          aria-expanded={filterOpen}
          className={cn(
            'relative rounded-lg p-2 transition-colors hover:bg-field',
            filterCount > 0 ? 'text-brand-500' : 'text-ink-muted',
          )}
        >
          <FilterIcon className="h-[19px] w-[19px]" />
          {filterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
              {filterCount}
            </span>
          )}
        </button>

        {filterOpen && (
          <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-pop">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Sender
            </p>
            <select
              value={filters.senderId ?? ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, senderId: e.target.value || null })
              }
              className="mb-3 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">All senders</option>
              {senders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.name}
                </option>
              ))}
            </select>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={filters.starredOnly}
                onChange={(e) => onFiltersChange({ ...filters, starredOnly: e.target.checked })}
                className="h-4 w-4 accent-brand-500"
              />
              Starred only
            </label>
          </div>
        )}
      </div>

      <button
        onClick={onRefresh}
        aria-label="Refresh"
        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-field"
      >
        <RefreshIcon className={cn('h-[19px] w-[19px]', refreshing && 'animate-spin')} />
      </button>
    </div>
  );
}
