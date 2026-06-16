import { useId, useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { operationOptions } from '@entities/operation';
import type { PipelineStepDraft } from '@entities/pipeline';
import { SortableNodeCard } from './NodeCard';
import { AddNodeMenu } from './AddNodeMenu';
import { useNodeConnections } from './useNodeConnections';

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
}) {
  const uid = useId();
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { connections, containerRef } = useNodeConnections(steps, selectedNodeId, nodeRefs);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
            if (
              e.target === e.currentTarget ||
              (e.target as HTMLElement).classList.contains('flow-bg')
            ) {
              onNodeSelect(null);
            }
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              <marker
                id={`${uid}-dot-active`}
                viewBox="0 0 6 6"
                refX="3"
                refY="3"
                markerWidth="4"
                markerHeight="4"
              >
                <circle cx="3" cy="3" r="2.5" fill="var(--accent-blue)" />
              </marker>
              <marker
                id={`${uid}-dot-default`}
                viewBox="0 0 6 6"
                refX="3"
                refY="3"
                markerWidth="4"
                markerHeight="4"
              >
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

          <div
            className="flow-bg flex h-full items-center gap-10 px-8 py-6"
            style={{ minWidth: 'max-content' }}
          >
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
