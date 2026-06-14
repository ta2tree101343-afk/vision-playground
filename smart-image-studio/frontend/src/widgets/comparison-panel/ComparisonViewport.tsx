import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const defaultTransform: ViewTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export function buildTransformStyle(transform: ViewTransform): CSSProperties {
  return {
    transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
    transformOrigin: 'center center',
  };
}

export function ComparisonViewport({
  title,
  caption,
  dimensionLabel,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
}: {
  title: string;
  caption: string;
  dimensionLabel?: string;
  children: ReactNode;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onWheel: (deltaY: number) => void;
}) {
  const viewportDivRef = useRef<HTMLDivElement>(null);
  const onWheelRef = useRef(onWheel);
  useEffect(() => { onWheelRef.current = onWheel; });

  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el) return;
    function handler(event: Event) {
      // preventDefault() must be called from a non-passive listener.
      // React registers onWheel as passive at the root, so we use a native listener here.
      event.preventDefault();
      onWheelRef.current((event as globalThis.WheelEvent).deltaY);
    }
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  return (
    <article
      className="rounded-2xl border p-4"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
            {caption}
          </p>
        </div>
        {dimensionLabel ? (
          <div
            className="rounded-full border px-3 py-1 text-xs"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            {dimensionLabel}
          </div>
        ) : null}
      </div>

      <div
        ref={viewportDivRef}
        className="relative h-[22rem] overflow-hidden rounded-xl border select-none"
        style={{
          touchAction: 'none',
          background: 'var(--bg-shell)',
          borderColor: 'var(--border-subtle)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </article>
  );
}
