import { forwardRef, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
import { getOperationOption, operationOptions } from '@features/operation-select/config/imageOperations';
import type { PipelineStepDraft } from '@entities/pipeline/model/pipeline.types';
import { NODE_ICONS, PlusIcon } from './studioIcons';
import { useNodeConnections } from './lib/useNodeConnections';

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

        <div className="absolute -left-1 top-1/2 -translate-y-1/2">
          <div
            className="h-2 w-2 rounded-full border"
            style={{ background: 'var(--connector-dot)', borderColor: 'var(--wire-color)' }}
          />
        </div>

        <div className="absolute -right-1 top-1/2 -translate-y-1/2">
          <div
            className="h-2 w-2 rounded-full border"
            style={{ background: 'var(--connector-dot)', borderColor: 'var(--wire-color)' }}
          />
        </div>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            background: selected ? 'var(--accent-blue-bg-mid)' : 'var(--node-icon-bg)',
            color: selected ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
          }}
        >
          <Icon className="h-5 w-5" />
        </div>

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

function AddNodeMenu({ onAdd }: { onAdd: (op: (typeof operationOptions)[number]['value']) => void }) {
  const [open, setOpen] = useState(false);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(320);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownMaxHeight(Math.max(120, window.innerHeight - rect.bottom - 8));
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
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
              maxHeight: `${dropdownMaxHeight}px`,
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
                  <span className="flex h-6 w-6 items-center justify-center rounded" style={{ background: 'var(--node-menu-icon-bg)' }}>
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

export function NodeFlowCanvas({
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
}): ReactNode {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const connections = useNodeConnections(containerRef, nodeRefs, steps, selectedNodeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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
