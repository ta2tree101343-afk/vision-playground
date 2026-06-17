import { useState, useEffect, useLayoutEffect, useRef, type SVGProps } from 'react';
import { NODE_ICONS } from '@shared/ui/studioIcons';
import { operationOptions } from '@entities/operation';
import type { OperationOption } from '@entities/operation';

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

const MENU_WIDTH = 192;
const MENU_GAP = 8;
const VIEWPORT_MARGIN = 12;
const MAX_MENU_HEIGHT = 320;

export function AddNodeMenu({
  onAdd,
}: {
  onAdd: (op: (typeof operationOptions)[number]['value']) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const top = rect.bottom + MENU_GAP;
      const availableHeight = window.innerHeight - top - VIEWPORT_MARGIN;
      const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN;

      setMenuPosition({
        left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)),
        top,
        maxHeight: Math.max(0, Math.min(MAX_MENU_HEIGHT, availableHeight)),
      });
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
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
            className="fixed z-20 overflow-y-auto rounded-xl border p-1 shadow-2xl"
            style={{
              width: MENU_WIDTH,
              left: menuPosition?.left ?? 0,
              top: menuPosition?.top ?? 0,
              maxHeight: `${menuPosition?.maxHeight ?? 0}px`,
              visibility: menuPosition ? 'visible' : 'hidden',
              background: 'var(--bg-panel-raised)',
              borderColor: 'var(--border-default)',
            }}
          >
            {operationOptions.map((opt: OperationOption) => {
              const Icon =
                NODE_ICONS[opt.value] ??
                (() => <span className="text-xs font-bold">{opt.icon}</span>);
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
    </>
  );
}
