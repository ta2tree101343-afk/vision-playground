import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PipelineStepDraft } from '@entities/pipeline/model/pipeline.types';

type Connection = { id: string; d: string; active: boolean };

export function useNodeConnections(
  steps: PipelineStepDraft[],
  selectedNodeId: string | null,
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connections, setConnections] = useState<Connection[]>([]);

  const measureConnections = () => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const newConns: Connection[] = [];

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
    measureConnectionsRef.current();
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

  return { connections, containerRef };
}
