import { useRef, useState, type PointerEvent } from 'react';
import { defaultTransform, type ViewTransform } from './ComparisonViewport';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useComparisonTransform() {
  const [transform, setTransform] = useState<ViewTransform>(defaultTransform);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      console.error('[ComparisonPanel] setPointerCapture failed:', error);
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.offsetX,
      originY: transform.offsetY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    setTransform((current) => ({
      ...current,
      offsetX: (dragRef.current?.originX ?? current.offsetX) + deltaX,
      offsetY: (dragRef.current?.originY ?? current.offsetY) + deltaY,
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // pointer capture がない場合は何もしない
      }
      dragRef.current = null;
    }
  }

  function handleWheel(deltaY: number) {
    setTransform((current) => {
      const nextScale = clamp(current.scale + (deltaY < 0 ? 0.14 : -0.14), 1, 5);
      return {
        scale: nextScale,
        offsetX: nextScale === 1 ? 0 : current.offsetX,
        offsetY: nextScale === 1 ? 0 : current.offsetY,
      };
    });
  }

  function zoomIn() {
    setTransform((current) => ({
      ...current,
      scale: clamp(current.scale + 0.2, 1, 5),
    }));
  }

  function zoomOut() {
    setTransform((current) => {
      const nextScale = clamp(current.scale - 0.2, 1, 5);
      return {
        scale: nextScale,
        offsetX: nextScale === 1 ? 0 : current.offsetX,
        offsetY: nextScale === 1 ? 0 : current.offsetY,
      };
    });
  }

  function resetTransform() {
    setTransform(defaultTransform);
  }

  return {
    transform,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    zoomIn,
    zoomOut,
    resetTransform,
  };
}
