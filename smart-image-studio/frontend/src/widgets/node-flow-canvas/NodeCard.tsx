import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NODE_ICONS } from '@shared/ui/studioIcons';
import { getOperationOption } from '@features/operation-select/config/imageOperations';
import type { PipelineStepDraft } from '@entities/pipeline/model/pipeline.types';

interface NodeCardProps {
  step: PipelineStepDraft;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
}

export const NodeCard = forwardRef<HTMLDivElement, NodeCardProps>(
  ({ step, selected, onClick, onRemove }, ref) => {
    const option = getOperationOption(step.operation);
    const Icon = NODE_ICONS[step.operation];

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
          {Icon ? <Icon className="h-5 w-5" /> : <span className="text-xs">{option.icon}</span>}
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

export function SortableNodeCard({
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
