import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ErrorBanner } from '@shared/ui/ErrorBanner';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { JobHistoryPanel } from '@widgets/job-history-panel/JobHistoryPanel';
import { JobStatusPanel } from '@widgets/job-status-panel/JobStatusPanel';
import { builtInPipelinePresets } from '@features/pipeline-edit/config/pipelinePresets';
import { PipelineEditor } from '@features/pipeline-edit/ui/PipelineEditor';
import { getOperationOption, operationOptions, operationLabelsJa, AI_OPS, allOperationKeys } from '@features/operation-select/config/imageOperations';
import { useImageFile } from '@features/image-upload/model/useImageFile';
import { useJobTracking } from '@features/job-tracking/model/useJobTracking';
import { usePipeline } from '@features/pipeline-edit/model/usePipeline';
import type { ImageProcessJob, OperationStep, OperationType } from '@shared/types/api';
import type { ParameterKey, PipelinePreset, PipelineStepDraft } from '@entities/pipeline/model/pipeline.types';
import { buildOperationStep } from '@features/pipeline-edit/lib/pipeline';
import { navigateTo } from '@shared/lib/navigation';

type StudioSectionId = 'processing' | 'pipeline' | 'jobs';

function SectionErrorFallback() {
  return (
    <div
      role="alert"
      className="flex h-full items-center justify-center text-sm"
      style={{ color: 'var(--text-muted)' }}
    >
      このセクションの表示中にエラーが発生しました。ページを再読み込みしてください。
    </div>
  );
}

// ─────────────────────── Icons ───────────────────────

function ImageProcessingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="2" y="4" width="16" height="12" rx="2" />
      <path d="M6 13.5 9.5 10l2.5 2.5 2-2.5 2 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PipelineNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="2" y="4" width="5" height="4" rx="1" />
      <rect x="13" y="4" width="5" height="4" rx="1" />
      <rect x="7.5" y="12" width="5" height="4" rx="1" />
      <path d="M7 6h3M13 6h-3" strokeLinecap="round" />
      <path d="M10 8v4" strokeLinecap="round" />
    </svg>
  );
}


function JobNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path d="M5.5 3.5 13 8l-7.5 4.5V3.5Z" />
    </svg>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m2 4 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M10 13V5" strokeLinecap="round" />
      <path d="m6 8 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" />
    </svg>
  );
}


// ─────────────────────── Operation node icons ───────────────────────

const NODE_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  grayscale: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 10h14M10 3v14" strokeOpacity="0.5" />
    </svg>
  ),
  blur: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="3" strokeOpacity="0.5" />
    </svg>
  ),
  sharpen: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10 3 17 17H3L10 3Z" />
      <path d="M10 7v5" strokeLinecap="round" />
    </svg>
  ),
  denoise: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 7h3l2 3 2-6 2 6 2-3h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h14" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  edge_detection: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 3v14M3 7h14" strokeOpacity="0.3" />
    </svg>
  ),
  brightness: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="4" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  ),
  contrast: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3v14" />
      <path d="M10 3a7 7 0 0 1 0 14" fill="currentColor" fillOpacity="0.4" stroke="none" />
    </svg>
  ),
  background_removal: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10 4 16 16H4L10 4Z" />
      <path d="M3 3l14 14" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  ocr: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="2" y="4" width="16" height="12" rx="1.5" />
      <path d="M5 8h10M5 11h7" strokeLinecap="round" />
    </svg>
  ),
  object_detection: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 6V4h2M17 6V4h-2M3 14v2h2M17 14v2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="7" width="8" height="6" rx="1" />
    </svg>
  ),
  caption_generation: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M4 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9.5L6 16v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M6.5 8h7M6.5 10.5h4" strokeLinecap="round" />
    </svg>
  ),
};

// ─────────────────────── Preset icons ───────────────────────

const PRESET_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  'builtin-sns': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-ocr': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="2" width="10" height="13" rx="1.5" />
      <path d="M5 6h6M5 9h4M5 12h5" strokeLinecap="round" />
      <circle cx="15" cy="15" r="3" />
      <path d="M17.1 17.1l1.4 1.4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-portrait': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
    </svg>
  ),
  'builtin-product': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10 2L17 5.5v9L10 18 3 14.5v-9L10 2Z" strokeLinejoin="round" />
      <path d="M10 18V10M3 5.5l7 4 7-4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-denoise': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 7h3l2 3 2-6 2 6 2-3h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h14" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  'builtin-scan': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="1.5" />
      <path d="M3 9.5h14" strokeWidth="2" />
      <path d="M6 13h8M6 16h5" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  ),
  'builtin-grayscale': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 10h14M10 3v14" strokeOpacity="0.5" />
    </svg>
  ),
  'builtin-detect': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 6V4h2M17 6V4h-2M3 14v2h2M17 14v2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="7" width="8" height="6" rx="1" />
    </svg>
  ),
  'builtin-caption': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M4 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9.5L6 16v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M6.5 8h7M6.5 10.5h4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-full-analysis': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  ),
  'builtin-lowlight': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M15.5 11.5A6.5 6.5 0 0 1 9 5a6.5 6.5 0 1 0 6.5 6.5Z" />
    </svg>
  ),
};

// ─────────────────────── NodeCard ───────────────────────

interface NodeCardProps {
  step: PipelineStepDraft;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
}

const NodeCard = forwardRef<HTMLDivElement, NodeCardProps>(
  ({ step, selected, onClick, onRemove }, ref) => {
    const option = getOperationOption(step.operation);
    const Icon = NODE_ICONS[step.operation] ?? (() => <span className="text-xs">{option.icon}</span>);

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={[
          'group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-3 py-3 transition-all duration-150 select-none',
          'min-w-[90px] max-w-[110px]',
          selected
            ? 'node-selected border-[--node-selected-border] bg-[--node-selected-bg]'
            : 'border-[--node-border] bg-[--node-bg] hover:border-[--border-strong] hover:bg-[--bg-panel-raised]',
        ].join(' ')}
        style={
          selected
            ? ({
                '--node-selected-border': 'var(--node-selected-border)',
                '--node-selected-bg': 'var(--node-selected-bg)',
              } as CSSProperties)
            : undefined
        }
      >
        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[--border-default] bg-[--bg-panel] text-[--text-muted] opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100 hover:text-[--text-secondary]"
          aria-label="削除"
          style={{ fontSize: '9px' }}
        >
          ×
        </button>

        {/* Left connector */}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2">
          <div
            className="h-2 w-2 rounded-full border"
            style={{
              background: 'var(--connector-dot)',
              borderColor: 'var(--wire-color)',
            }}
          />
        </div>

        {/* Right connector */}
        <div className="absolute -right-1 top-1/2 -translate-y-1/2">
          <div
            className="h-2 w-2 rounded-full border"
            style={{
              background: 'var(--connector-dot)',
              borderColor: 'var(--wire-color)',
            }}
          />
        </div>

        {/* Icon */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            background: selected ? 'rgba(42, 91, 200, 0.15)' : 'rgba(255,255,255,0.04)',
            color: selected ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
          }}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Label */}
        <span
          className="text-center text-[10px] font-medium leading-tight"
          style={{ color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}
        >
          {option.label}
        </span>
      </div>
    );
  },
);
NodeCard.displayName = 'NodeCard';

// ─────────────────────── SortableNodeCard ───────────────────────

function SortableNodeCard({
  step,
  selected,
  onClick,
  onRemove,
  onNodeRef,
}: Omit<NodeCardProps, 'onClick'> & {
  onClick: () => void;
  onNodeRef: (el: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: step.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <NodeCard ref={onNodeRef} step={step} selected={selected} onClick={onClick} onRemove={onRemove} />
    </div>
  );
}

// ─────────────────────── AddNodeMenu ───────────────────────

function AddNodeMenu({ onAdd }: { onAdd: (op: (typeof operationOptions)[number]['value']) => void }) {
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
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <PlusIcon className="h-5 w-5" />
        </div>
        <span className="text-center text-[10px] font-medium leading-tight">Add Node / Tool</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-full z-20 mt-2 w-48 overflow-y-auto rounded-xl border p-1 shadow-2xl"
            style={{
              maxHeight: '320px',
              background: 'var(--bg-panel-raised)',
              borderColor: 'var(--border-default)',
            }}
          >
            {operationOptions.map((opt) => {
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
                  <span className="flex h-6 w-6 items-center justify-center rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
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

// ─────────────────────── NodeFlowCanvas ───────────────────────

function NodeFlowCanvas({
  steps,
  selectedNodeId,
  onNodeSelect,
  onAddOperation,
  onRemoveStep,
  onReorderSteps,
}: {
  steps: PipelineStepDraft[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onAddOperation: (op: (typeof operationOptions)[number]['value']) => void;
  onRemoveStep: (id: string) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
}) {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connections, setConnections] = useState<Array<{ id: string; d: string; active: boolean }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const measureConnections = () => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const newConns: Array<{ id: string; d: string; active: boolean }> = [];

    steps.forEach((step, i) => {
      if (i === steps.length - 1) return;
      const fromEl = nodeRefs.current.get(step.id);
      const toEl = nodeRefs.current.get(steps[i + 1].id);
      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const x1 = fromRect.right - containerRect.left + scrollLeft;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const x2 = toRect.left - containerRect.left + scrollLeft;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;
      const cx = (x1 + x2) / 2;

      const isActive = step.id === selectedNodeId || steps[i + 1].id === selectedNodeId;

      newConns.push({
        id: `${step.id}-${steps[i + 1].id}`,
        d: `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`,
        active: isActive,
      });
    });

    setConnections(newConns);
  };

  const measureConnectionsRef = useRef(measureConnections);
  useLayoutEffect(() => { measureConnectionsRef.current = measureConnections; });

  useLayoutEffect(() => {
    measureConnections();
  }, [steps, selectedNodeId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cb = () => measureConnectionsRef.current();
    container.addEventListener('scroll', cb);
    const observer = new ResizeObserver(cb);
    observer.observe(container);
    return () => {
      container.removeEventListener('scroll', cb);
      observer.disconnect();
    };
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = steps.findIndex((s) => s.id === active.id);
    const toIndex = steps.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderSteps(fromIndex, toIndex);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
        <div
          ref={containerRef}
          className="relative h-full overflow-x-auto overflow-y-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('flow-bg')) {
              onNodeSelect(null);
            }
          }}
        >
          {/* SVG connection layer */}
          <svg
            className="pointer-events-none absolute inset-0"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              <marker id={`${uid}-dot-active`} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4">
                <circle cx="3" cy="3" r="2.5" fill="var(--accent-blue)" />
              </marker>
              <marker id={`${uid}-dot-default`} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4">
                <circle cx="3" cy="3" r="2.5" fill="var(--wire-color)" />
              </marker>
            </defs>
            {connections.map((c) => (
              <path
                key={c.id}
                d={c.d}
                stroke={c.active ? 'var(--accent-blue)' : 'var(--wire-color)'}
                strokeWidth={c.active ? 2 : 1.5}
                fill="none"
                strokeDasharray={c.active ? undefined : '4 3'}
                opacity={c.active ? 0.9 : 0.5}
                markerEnd={c.active ? `url(#${uid}-dot-active)` : `url(#${uid}-dot-default)`}
              />
            ))}
          </svg>

          {/* Nodes row */}
          <div className="flow-bg flex h-full items-center gap-10 px-8 py-6" style={{ minWidth: 'max-content' }}>
            <AddNodeMenu onAdd={onAddOperation} />

            {steps.map((step) => (
              <SortableNodeCard
                key={step.id}
                step={step}
                selected={step.id === selectedNodeId}
                onClick={() => onNodeSelect(step.id === selectedNodeId ? null : step.id)}
                onRemove={() => onRemoveStep(step.id)}
                onNodeRef={(el) => {
                  if (el) nodeRefs.current.set(step.id, el);
                  else nodeRefs.current.delete(step.id);
                }}
              />
            ))}

            {steps.length === 0 && (
              <div
                className="flex flex-col items-center gap-2 text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                <div className="text-sm">パイプラインは空です。</div>
                <div className="text-xs">「Add Node / Tool」からステップを追加してください。</div>
              </div>
            )}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─────────────────────── InspectorSlider ───────────────────────

function InspectorSlider({
  label,
  paramKey,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  paramKey: ParameterKey;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (key: ParameterKey, value: number) => void;
}) {
  const range = max - min;
  const pct = range > 0 ? ((value - min) / range) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span
          className="font-mono-val text-[11px] tabular-nums"
          style={{ color: 'var(--text-primary)', minWidth: '3.5em', textAlign: 'right' }}
        >
          {value.toFixed(2)}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(paramKey, Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ ['--range-fill' as string]: `${pct}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

// ─────────────────────── InspectorSection ───────────────────────

function InspectorSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="inspector-section">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
        style={{ background: 'transparent' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <div className="flex items-center" style={{ color: 'var(--text-muted)' }}>
          <ChevronDownIcon
            className="h-3 w-3 transition-transform"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        </div>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─────────────────────── MiniHistogram ───────────────────────

function MiniHistogram() {
  // Decorative placeholder — not connected to real pixel data
  const bars = [4, 8, 14, 22, 35, 48, 60, 72, 78, 82, 85, 80, 72, 60, 48, 40, 32, 25, 18, 12, 8, 6, 4, 3];
  const max = Math.max(...bars);

  return (
    <div className="mt-3">
      <div className="mb-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        ヒストグラム（参考）
      </div>
      <div
        className="flex h-12 items-end gap-px overflow-hidden rounded-md"
        style={{ background: 'var(--bg-input)' }}
      >
        {bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] transition-all"
            style={{
              height: `${(v / max) * 100}%`,
              background: 'rgba(74, 127, 240, 0.6)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────── Inspector Panel ───────────────────────

function InspectorPanel({
  selectedStep,
  stepCount,
  builtInPresets,
  isProcessing,
  canProcess,
  onParameterChange,
  onApplyPreset,
  onProcess,
  activePresetId,
}: {
  selectedStep: PipelineStepDraft | null;
  stepCount: number;
  builtInPresets: PipelinePreset[];
  isProcessing: boolean;
  canProcess: boolean;
  activePresetId: string | null;
  onParameterChange: (stepId: string, key: ParameterKey, value: number) => void;
  onApplyPreset: (preset: PipelinePreset) => void;
  onProcess: () => void | Promise<void>;
}) {
  const option = selectedStep ? getOperationOption(selectedStep.operation) : null;

  return (
    <aside
      className="flex flex-col border-l"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
        width: '260px',
        flexShrink: 0,
      }}
    >
      {/* Run button */}
      <div
        className="flex gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => void onProcess()}
          disabled={!canProcess || isProcessing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white transition-all"
          style={{
            background: !canProcess || isProcessing ? 'var(--bg-input)' : 'var(--accent-green)',
            color: !canProcess || isProcessing ? 'var(--text-muted)' : 'white',
            cursor: !canProcess || isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          <PlayIcon className="h-3 w-3" />
          {isProcessing ? '実行中...' : stepCount > 0 ? `実行 (${stepCount})` : '実行'}
        </button>
      </div>

      {/* Scrollable parameter area */}
      <div className="flex-1 overflow-y-auto">
        {selectedStep && option ? (
          <>
            {/* Node header */}
            <div
              className="border-b px-4 py-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: 'rgba(42, 91, 200, 0.15)', color: 'var(--accent-blue-bright)' }}
                >
                  {(() => {
                    const Icon = NODE_ICONS[selectedStep.operation];
                    return Icon ? <Icon className="h-4 w-4" /> : null;
                  })()}
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {option.label}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {option.description}
              </p>
            </div>

            {/* Parameters */}
            {option.parameters.length > 0 ? (
              <InspectorSection title={option.label} defaultOpen>
                {option.parameters.map((param) => (
                  <InspectorSlider
                    key={param.key}
                    label={param.label}
                    paramKey={param.key}
                    value={selectedStep.parameters[param.key] ?? param.min}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    onChange={(key, val) => onParameterChange(selectedStep.id, key, val)}
                  />
                ))}
                {option.parameters.length > 0 && <MiniHistogram />}
              </InspectorSection>
            ) : (
              <div className="px-4 py-6 text-center">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  このノードに調整可能なパラメータはありません。
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              フロー内のノードをクリックすると
              <br />
              ここにパラメータが表示されます。
            </div>
          </div>
        )}

        {/* Presets section */}
        <InspectorSection title="プリセット" defaultOpen>
          <div className="space-y-1">
            {builtInPresets.map((preset) => {
              const isActive = preset.id === activePresetId;
              const Icon = PRESET_ICONS[preset.id];
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPreset(preset)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all${!isActive ? ' hover-border-accent' : ''}`}
                  style={{
                    background: isActive ? 'rgba(42, 91, 200, 0.1)' : 'var(--bg-input)',
                    border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                  }}
                >
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
                    style={{
                      background: isActive ? 'rgba(42, 91, 200, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: isActive ? 'var(--accent-blue-bright)' : 'var(--text-muted)',
                    }}
                  >
                    {Icon && <Icon className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="text-xs font-semibold leading-tight"
                        style={{ color: isActive ? 'var(--accent-blue-bright)' : 'var(--text-primary)' }}
                      >
                        {preset.name}
                      </span>
                      <span
                        className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold${isActive ? '' : ' invisible'}`}
                        style={{ background: 'var(--accent-blue)', color: 'white' }}
                      >
                        ✓
                      </span>
                    </div>
                    <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

// ─────────────────────── ComparisonStrip ───────────────────────

function ComparisonStrip({
  beforeUrl,
  selectedFileName,
  onFileSelect,
}: {
  beforeUrl: string | null;
  selectedFileName?: string;
  onFileSelect: (file: File | null) => void;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: '220px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-shell)',
      }}
    >
      {beforeUrl ? (
        <>
          <img
            src={beforeUrl}
            alt="元画像"
            className="h-full w-full object-contain"
            style={{ filter: 'brightness(0.95)' }}
          />
          <div className="absolute left-3 top-3 z-10 flex items-baseline gap-2">
            <span
              className="font-display text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}
            >
              Before
            </span>
            <span className="font-mono-val text-[10px]" style={{ color: 'var(--text-muted)' }}>
              元画像
            </span>
          </div>
          {selectedFileName && (
            <div
              className="absolute bottom-3 left-3 font-mono-val text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              {selectedFileName}
            </div>
          )}
        </>
      ) : (
        <label
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2"
          style={{ background: 'var(--bg-shell)' }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
          >
            <UploadIcon className="h-5 w-5" />
          </div>
          <div className="text-center">
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              クリックして画像を選択
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              PNG · JPG · WebP · TIFF
            </div>
          </div>
          <input
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
          />
        </label>
      )}


    </div>
  );
}

// ─────────────────────── Sidebar ───────────────────────

interface NavItem {
  id: StudioSectionId;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
}

const navItems: NavItem[] = [
  { id: 'processing', label: '画像処理', Icon: ImageProcessingIcon },
  { id: 'pipeline', label: 'パイプライン', Icon: PipelineNavIcon },
  { id: 'jobs', label: '処理履歴', Icon: JobNavIcon },
];

function StudioSidebar({
  activeSection,
  jobBadge,
  onSelect,
}: {
  activeSection: StudioSectionId;
  jobBadge: number;
  onSelect: (id: StudioSectionId) => void;
}) {
  return (
    <aside
      className="flex flex-col border-r py-4"
      style={{
        width: '200px',
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
      }}
    >
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map(({ id, label, Icon }) => {
          const active = activeSection === id;
          const badge = id === 'jobs' && jobBadge > 0 ? jobBadge : 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all${!active ? ' hover-bg-sidebar hover-text-primary' : ''}`}
              style={{
                background: active ? 'var(--sidebar-item-active)' : 'transparent',
                border: active
                  ? '1px solid var(--sidebar-item-active-border)'
                  : '1px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <Icon
                className="h-4 w-4 flex-shrink-0"
                style={{
                  color: active ? 'var(--accent-blue-bright)' : 'inherit',
                }}
              />
              <span className="text-sm font-medium">{label}</span>
              {badge > 0 && (
                <span
                  className="ml-auto flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--accent-blue)', color: 'white' }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ─────────────────────── Topbar ───────────────────────

function Topbar() {
  return (
    <header
      className="flex items-center justify-between border-b px-5 py-3"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center">
        <span
          className="text-sm font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}
        >
          Smart Image Studio
        </span>
      </div>
    </header>
  );
}

// ─────────────────────── Section shells ───────────────────────


function SectionShell({ title, headerRight, children }: { title: string; headerRight?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h2
          className="font-display text-lg font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}
        >
          {title}
        </h2>
        {headerRight}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </div>
  );
}


function JobsSection({
  activeJob,
  jobHistory,
  onOpenResult,
}: {
  activeJob: ImageProcessJob | null;
  jobHistory: ImageProcessJob[];
  onOpenResult: (job: ImageProcessJob) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedOperations, setSelectedOperations] = useState<OperationType[]>([]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayJobs = jobHistory.filter((j) => new Date(j.created_at) >= todayStart);
  const todayCompleted = todayJobs.filter((j) => j.status === 'completed');
  const avgMs =
    todayCompleted.length > 0
      ? todayCompleted.reduce((sum, j) => {
          const start = j.started_at ? new Date(j.started_at).getTime() : null;
          const end = j.completed_at ? new Date(j.completed_at).getTime() : null;
          return start !== null && end !== null ? sum + (end - start) : sum;
        }, 0) / todayCompleted.length
      : null;
  const avgTimeStr = avgMs !== null ? `${(avgMs / 1000).toFixed(1)}秒` : '-';

  const hasFilter = searchQuery.trim() !== '' || filterDate !== '' || selectedOperations.length > 0;

  function toggleOperation(op: OperationType) {
    setSelectedOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  }

  function clearFilters() {
    setSearchQuery('');
    setFilterDate('');
    setSelectedOperations([]);
  }

  const filterButton = (
    <div className="relative">
      {filterOpen && <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />}
      <button
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        className="relative z-20 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all"
        style={{
          background: hasFilter ? 'rgba(42,91,200,0.12)' : 'var(--bg-input)',
          borderColor: hasFilter ? 'var(--accent-blue)' : 'var(--border-default)',
          color: hasFilter ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        絞り込み
        {hasFilter && (
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: 'var(--accent-blue)', color: 'white' }}
          >
            {(searchQuery.trim() !== '' ? 1 : 0) + (filterDate !== '' ? 1 : 0) + (selectedOperations.length > 0 ? 1 : 0)}
          </span>
        )}
      </button>

      {filterOpen && (
        <div
          className="absolute right-0 top-full z-20 mt-2 rounded-xl border p-4 shadow-xl"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-default)', minWidth: '480px' }}
        >
          {/* Row 1: ファイル名 + 日付 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold tracking-widest" style={{ color: 'var(--text-muted)' }}>
                ファイル名
              </div>
              <input
                type="text"
                placeholder="例: 藤田、しんじ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[10px] font-semibold tracking-widest" style={{ color: 'var(--text-muted)' }}>
                日付
              </div>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
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

          {/* Row 2: 処理の種類 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-widest" style={{ color: 'var(--text-muted)' }}>
                処理の種類
              </span>
              {hasFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
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
              {allOperationKeys.map((op) => {
                const Icon = NODE_ICONS[op];
                const isAI = AI_OPS.has(op);
                const selected = selectedOperations.includes(op);
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => toggleOperation(op)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                    style={{
                      background: selected
                        ? isAI ? 'rgba(147,51,234,0.15)' : 'rgba(42,91,200,0.15)'
                        : 'var(--bg-input)',
                      border: `1px solid ${selected
                        ? isAI ? 'rgba(147,51,234,0.5)' : 'var(--accent-blue)'
                        : 'var(--border-default)'}`,
                      color: selected
                        ? isAI ? '#c084fc' : 'var(--accent-blue-bright)'
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

  return (
    <SectionShell title="処理履歴" headerRight={filterButton}>
      <div className="space-y-4">
        {todayJobs.length > 0 && (
          <div
            className="grid grid-cols-3 gap-3 rounded-xl border px-4 py-3"
            style={{ background: 'var(--bg-panel-raised)', borderColor: 'var(--border-default)' }}
          >
            {[
              { label: '本日の処理数', value: `${todayJobs.length}` },
              { label: '完了数', value: `${todayCompleted.length}` },
              { label: '平均処理時間', value: avgTimeStr },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </div>
                <div className="mt-1 font-mono-val text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
        <JobStatusPanel job={activeJob} />
        <JobHistoryPanel
          jobs={jobHistory}
          onOpenResult={onOpenResult}
          searchQuery={searchQuery}
          filterDate={filterDate}
          selectedOperations={selectedOperations}
        />
      </div>
    </SectionShell>
  );
}

function PipelineSection({
  pipelineSteps,
  onAddOperation,
  onMoveStep,
  onRemoveStep,
  onParameterChange,
}: {
  pipelineSteps: PipelineStepDraft[];
  onAddOperation: (op: (typeof operationOptions)[number]['value']) => void;
  onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
  onRemoveStep: (stepId: string) => void;
  onParameterChange: (stepId: string, key: ParameterKey, value: number) => void;
}) {
  return (
    <SectionShell title="パイプライン">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          処理を追加
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {operationOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onAddOperation(opt.value)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <PipelineEditor
        steps={pipelineSteps}
        onMoveStep={onMoveStep}
        onRemoveStep={onRemoveStep}
        onParameterChange={onParameterChange}
      />
    </SectionShell>
  );
}

// ─────────────────────── Main StudioPage ───────────────────────

export function StudioPage() {
  const [activeSection, setActiveSection] = useState<StudioSectionId>('processing');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const file = useImageFile();
  const pipeline = usePipeline();
  const jobs = useJobTracking({
    onCompleted: () => {
      navigateTo('/result');
    },
  });

  const canProcess = !!file.selectedFile && pipeline.steps.length > 0;
  const activeJobCount = jobs.jobHistory.filter(
    (j) => j.status === 'queued' || j.status === 'running',
  ).length;

  const selectedStep = pipeline.steps.find((s) => s.id === selectedNodeId) ?? null;

  const isProcessingView = activeSection === 'processing';

  function handleProcess() {
    if (!file.selectedFile) return;
    let ops: OperationStep[];
    try {
      ops = pipeline.steps.map(buildOperationStep);
    } catch (error) {
      console.error('[StudioPage] Failed to build operation steps:', error);
      pipeline.setErrorMessage(error instanceof Error ? error.message : 'パイプラインのビルドに失敗しました。');
      return;
    }
    void jobs.submitJob(file.selectedFile, ops);
  }

  function renderCenterContent() {
    if (isProcessingView) {
      return (
        <div className="flex h-full flex-col" style={{ minHeight: 0 }}>
          <ComparisonStrip
            beforeUrl={file.previewUrl}
            selectedFileName={file.selectedFile?.name}
            onFileSelect={file.selectFile}
          />

          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <NodeFlowCanvas
              steps={pipeline.steps}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
              onAddOperation={pipeline.addStep}
              onRemoveStep={pipeline.removeStep}
              onReorderSteps={pipeline.reorderSteps}
            />
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case 'pipeline':
        return (
          <ErrorBoundary fallback={<SectionErrorFallback />}>
            <PipelineSection
              pipelineSteps={pipeline.steps}
              onAddOperation={pipeline.addStep}
              onMoveStep={pipeline.moveStep}
              onRemoveStep={pipeline.removeStep}
              onParameterChange={pipeline.updateStepParameter}
            />
          </ErrorBoundary>
        );
      case 'jobs':
        return (
          <ErrorBoundary fallback={<SectionErrorFallback />}>
            <JobsSection
              activeJob={jobs.activeJob}
              jobHistory={jobs.jobHistory}
              onOpenResult={jobs.openJobResult}
            />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="studio-dark flex min-h-screen flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <Topbar />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <StudioSidebar
          activeSection={activeSection}
          jobBadge={activeJobCount}
          onSelect={(id) => {
            setActiveSection(id);
            setSelectedNodeId(null);
          }}
        />

        <div className="flex flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
          {(file.errorMessage || pipeline.errorMessage || jobs.errorMessage) && (
            <div className="flex-shrink-0 flex flex-col gap-2 px-4 pt-3">
              {file.errorMessage && <ErrorBanner message={file.errorMessage} />}
              {pipeline.errorMessage && <ErrorBanner message={pipeline.errorMessage} />}
              {jobs.errorMessage && <ErrorBanner message={jobs.errorMessage} />}
            </div>
          )}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {renderCenterContent()}
          </div>
        </div>

        {isProcessingView && (
          <InspectorPanel
            selectedStep={selectedStep}
            stepCount={pipeline.steps.length}
            builtInPresets={builtInPipelinePresets}
            isProcessing={jobs.isProcessing}
            canProcess={canProcess}
            onParameterChange={pipeline.updateStepParameter}
            onApplyPreset={pipeline.applyPreset}
            onProcess={handleProcess}
            activePresetId={pipeline.activePresetId}
          />
        )}
      </div>
    </div>
  );
}
