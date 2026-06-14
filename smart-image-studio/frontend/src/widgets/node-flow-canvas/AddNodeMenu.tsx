import { useState, useEffect, type SVGProps } from 'react';
import { NODE_ICONS } from '@shared/ui/studioIcons';
import { operationOptions } from '@features/operation-select/config/imageOperations';
import type { OperationOption } from '@features/operation-select/model/operation.types';

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

export function AddNodeMenu({ onAdd }: { onAdd: (op: (typeof operationOptions)[number]['value']) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[90px] flex-col items-center gap-2 rounded-xl border px-3 py-3 transition-all duration-150 hover-border-accent hover-text-accent"
        style={{
          borderColor: 'var(--border-default)',
          borderStyle: 'dashed',
          background: 'transparent',
          color: 'var(--text-muted)',
        }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: 'var(--node-add-icon-bg)' }}
        >
          <PlusIcon className="h-5 w-5" />
        </div>
        <span className="text-center text-[10px] font-medium leading-tight">Add Node / Tool</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-20 mt-2 w-48 overflow-y-auto rounded-xl border p-1 shadow-2xl"
            style={{
              maxHeight: '320px',
              background: 'var(--bg-panel-raised)',
              borderColor: 'var(--border-default)',
            }}
          >
            {operationOptions.map((opt: OperationOption) => {
              const Icon = NODE_ICONS[opt.value] ?? (() => <span className="text-xs font-bold">{opt.icon}</span>);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onAdd(opt.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover-bg-subtle hover-text-primary"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
