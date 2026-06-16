import { useState } from 'react';
import { NODE_ICONS } from '@shared/ui/studioIcons';
import { AI_OPS, allOperationKeys, operationLabelsJa } from '@entities/operation';
import type { OperationType } from '@shared/types/api';

export function JobsFilterButton({
  searchQuery,
  filterDate,
  selectedOperations,
  onSearchChange,
  onDateChange,
  onToggleOperation,
  onClearFilters,
}: {
  searchQuery: string;
  filterDate: string;
  selectedOperations: OperationType[];
  onSearchChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onToggleOperation: (op: OperationType) => void;
  onClearFilters: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);

  const hasFilter = searchQuery.trim() !== '' || filterDate !== '' || selectedOperations.length > 0;
  const activeCount =
    (searchQuery.trim() !== '' ? 1 : 0) +
    (filterDate !== '' ? 1 : 0) +
    (selectedOperations.length > 0 ? 1 : 0);

  return (
    <div className="relative">
      {filterOpen && <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />}
      <button
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        className="relative z-20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all"
        style={{
          background: hasFilter ? 'var(--accent-blue-bg)' : 'var(--bg-input)',
          borderColor: hasFilter ? 'var(--accent-blue)' : 'var(--border-default)',
          color: hasFilter ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
          <path
            d="M2 4h12M4 8h8M6 12h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        絞り込み
        {hasFilter && (
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: 'var(--accent-blue)', color: 'white' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {filterOpen && (
        <div
          className="absolute right-0 top-full z-20 mt-2 rounded-xl border p-4 shadow-xl"
          style={{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-default)',
            width: 'min(480px, calc(100vw - 32px))',
          }}
        >
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div
                className="mb-1.5 text-[10px] font-semibold tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                ファイル名
              </div>
              <input
                type="text"
                placeholder="例: 藤田、しんじ..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <div
                className="mb-1.5 text-[10px] font-semibold tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                日付
              </div>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  color: filterDate ? 'var(--text-primary)' : 'var(--text-muted)',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span
                className="text-[10px] font-semibold tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                処理の種類
              </span>
              {hasFilter && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: 'transparent',
                    borderColor: 'var(--accent-blue)',
                    color: 'var(--accent-blue-bright)',
                  }}
                >
                  <span>×</span> クリア
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allOperationKeys.map((op: OperationType) => {
                const Icon = NODE_ICONS[op];
                const isAI = AI_OPS.has(op);
                const selected = selectedOperations.includes(op);
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => onToggleOperation(op)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                    style={{
                      background: selected
                        ? isAI
                          ? 'var(--accent-purple-bg)'
                          : 'var(--accent-blue-bg-mid)'
                        : 'var(--bg-input)',
                      border: `1px solid ${
                        selected
                          ? isAI
                            ? 'var(--accent-purple-border-strong)'
                            : 'var(--accent-blue)'
                          : 'var(--border-default)'
                      }`,
                      color: selected
                        ? isAI
                          ? 'var(--accent-purple-text)'
                          : 'var(--accent-blue-bright)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {Icon && <Icon className="h-3 w-3" />}
                    {operationLabelsJa[op]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
