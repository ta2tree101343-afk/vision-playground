import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useComparisonTransform } from '@widgets/comparison-panel/useComparisonTransform';

function makePointerEvent(overrides: Partial<PointerEvent> = {}): ReactPointerEvent<HTMLDivElement> {
  return {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    currentTarget: {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    },
    ...overrides,
  } as unknown as ReactPointerEvent<HTMLDivElement>;
}

describe('useComparisonTransform initial state', () => {
  it('starts with scale 1', () => {
    const { result } = renderHook(() => useComparisonTransform());
    expect(result.current.transform.scale).toBe(1);
  });

  it('starts with offsetX 0', () => {
    const { result } = renderHook(() => useComparisonTransform());
    expect(result.current.transform.offsetX).toBe(0);
  });

  it('starts with offsetY 0', () => {
    const { result } = renderHook(() => useComparisonTransform());
    expect(result.current.transform.offsetY).toBe(0);
  });
});

describe('zoomIn', () => {
  it('increases scale by 0.2', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    expect(result.current.transform.scale).toBeCloseTo(1.2);
  });

  it('clamps scale at 5', () => {
    const { result } = renderHook(() => useComparisonTransform());
    for (let i = 0; i < 25; i++) act(() => { result.current.zoomIn(); });
    expect(result.current.transform.scale).toBe(5);
  });
});

describe('zoomOut', () => {
  it('decreases scale by 0.2', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => { result.current.zoomIn(); });
    act(() => { result.current.zoomOut(); });
    expect(result.current.transform.scale).toBeCloseTo(1.2);
  });

  it('clamps scale at 1 (cannot go below)', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomOut(); });
    act(() => { result.current.zoomOut(); });
    expect(result.current.transform.scale).toBe(1);
  });

  it('resets offsetX and offsetY to 0 when scale reaches 1', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => {
      result.current.handlePointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
    });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 50, clientY: 30 }));
    });
    act(() => { result.current.zoomOut(); });
    expect(result.current.transform.offsetX).toBe(0);
    expect(result.current.transform.offsetY).toBe(0);
  });
});

describe('handleWheel', () => {
  it('zooms in when deltaY < 0', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.handleWheel(-1); });
    expect(result.current.transform.scale).toBeCloseTo(1.14);
  });

  it('zooms out when deltaY > 0', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => { result.current.handleWheel(1); });
    expect(result.current.transform.scale).toBeCloseTo(1.06);
  });

  it('resets offsets to 0 when zooming out to scale 1', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => {
      result.current.handlePointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
    });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 40, clientY: 20 }));
    });
    // zoom out until scale hits 1
    for (let i = 0; i < 10; i++) act(() => { result.current.handleWheel(1); });
    expect(result.current.transform.offsetX).toBe(0);
    expect(result.current.transform.offsetY).toBe(0);
  });
});

describe('resetTransform', () => {
  it('restores scale to 1', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => { result.current.resetTransform(); });
    expect(result.current.transform.scale).toBe(1);
  });

  it('restores offsets to 0', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => {
      result.current.handlePointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
    });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 80, clientY: 60 }));
    });
    act(() => { result.current.resetTransform(); });
    expect(result.current.transform.offsetX).toBe(0);
    expect(result.current.transform.offsetY).toBe(0);
  });
});

describe('handlePointerDown / handlePointerMove / handlePointerUp', () => {
  it('updates offsetX and offsetY while dragging', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => {
      result.current.handlePointerDown(makePointerEvent({ clientX: 100, clientY: 50 }));
    });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 160, clientY: 80 }));
    });
    expect(result.current.transform.offsetX).toBe(60);
    expect(result.current.transform.offsetY).toBe(30);
  });

  it('ignores pointer move when no drag is active', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 100, clientY: 50 }));
    });
    expect(result.current.transform.offsetX).toBe(0);
    expect(result.current.transform.offsetY).toBe(0);
  });

  it('ignores non-primary button pointer down', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => {
      result.current.handlePointerDown(makePointerEvent({ button: 2, clientX: 0, clientY: 0 }));
    });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 100, clientY: 50 }));
    });
    expect(result.current.transform.offsetX).toBe(0);
  });

  it('stops updating offset after pointer up', () => {
    const { result } = renderHook(() => useComparisonTransform());
    act(() => { result.current.zoomIn(); });
    act(() => {
      result.current.handlePointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
    });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 20, clientY: 10 }));
    });
    act(() => {
      result.current.handlePointerUp(makePointerEvent());
    });
    act(() => {
      result.current.handlePointerMove(makePointerEvent({ clientX: 100, clientY: 100 }));
    });
    expect(result.current.transform.offsetX).toBe(20);
    expect(result.current.transform.offsetY).toBe(10);
  });
});
