import { describe, it, expect, afterEach } from 'vitest';
import { isBrowser, getSessionStorage } from '@shared/lib/browser';

// jsdom provides window, so the browser path is the default.
// The SSR path is exercised by temporarily removing globalThis.window.

function withoutWindow<T>(fn: () => T): T {
  const saved = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = undefined;
  try {
    return fn();
  } finally {
    (globalThis as Record<string, unknown>).window = saved;
  }
}

afterEach(() => {
  // Guarantee window is restored even if a test throws.
  if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
    (globalThis as Record<string, unknown>).window = globalThis;
  }
});

describe('isBrowser', () => {
  it('returns true in a browser (jsdom) environment', () => {
    expect(isBrowser()).toBe(true);
  });

  it('returns false when window is not defined (SSR)', () => {
    expect(withoutWindow(() => isBrowser())).toBe(false);
  });
});

describe('getSessionStorage', () => {
  it('returns the sessionStorage object in a browser environment', () => {
    const storage = getSessionStorage();
    expect(storage).toBe(window.sessionStorage);
  });

  it('returns null when window is not defined (SSR)', () => {
    expect(withoutWindow(() => getSessionStorage())).toBeNull();
  });
});
