import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadComparisonAssets } from '@entities/image/lib/imageComparison';

// Factory that returns an Image-like class with configurable natural dimensions.
function makeImageClass(naturalWidth = 200, naturalHeight = 150) {
  return class {
    naturalWidth = naturalWidth;
    naturalHeight = naturalHeight;
    crossOrigin = '';
    decoding = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_: string) {
      // Trigger onload on the next microtask tick.
      Promise.resolve().then(() => this.onload?.());
    }
  };
}

beforeEach(() => {
  vi.stubGlobal('Image', makeImageClass());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadComparisonAssets', () => {
  it('resolves without throwing even when canvas is unavailable', async () => {
    await expect(
      loadComparisonAssets('http://example.com/before.jpg', 'http://example.com/after.jpg'),
    ).resolves.toBeDefined();
  });

  it('returns before.src matching the first argument', async () => {
    const assets = await loadComparisonAssets('http://x.com/b.jpg', 'http://x.com/a.jpg');
    expect(assets.before.src).toBe('http://x.com/b.jpg');
  });

  it('returns after.src matching the second argument', async () => {
    const assets = await loadComparisonAssets('http://x.com/b.jpg', 'http://x.com/a.jpg');
    expect(assets.after.src).toBe('http://x.com/a.jpg');
  });

  it('returns before dimensions from naturalWidth/naturalHeight', async () => {
    vi.stubGlobal('Image', makeImageClass(400, 300));
    const assets = await loadComparisonAssets('http://x.com/b.jpg', 'http://x.com/a.jpg');
    expect(assets.before.width).toBe(400);
    expect(assets.before.height).toBe(300);
  });

  it('returns after dimensions from naturalWidth/naturalHeight', async () => {
    vi.stubGlobal('Image', makeImageClass(640, 480));
    const assets = await loadComparisonAssets('http://x.com/b.jpg', 'http://x.com/a.jpg');
    expect(assets.after.width).toBe(640);
    expect(assets.after.height).toBe(480);
  });

  it('sets diagnostics when canvas context is unavailable (jsdom limitation)', async () => {
    // jsdom does not implement canvas getContext('2d'), so histogram computation
    // always fails and diagnostics is non-null.
    const assets = await loadComparisonAssets('http://x.com/b.jpg', 'http://x.com/a.jpg');
    expect(assets.diagnostics).not.toBeNull();
  });

  it('sets diagnostics when image sizes differ (diff cannot be computed)', async () => {
    let callCount = 0;
    vi.stubGlobal('Image', class {
      naturalWidth = ++callCount === 1 ? 100 : 200;
      naturalHeight = 100;
      crossOrigin = '';
      decoding = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { Promise.resolve().then(() => this.onload?.()); }
    });

    const assets = await loadComparisonAssets('http://x.com/b.jpg', 'http://x.com/a.jpg');
    // diagnostics contains the mismatch or canvas error message
    expect(assets.diagnostics).not.toBeNull();
    expect(assets.diffDataUrl).toBeNull();
  });

  it('rejects when an image fails to load', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 0;
      naturalHeight = 0;
      crossOrigin = '';
      decoding = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { Promise.resolve().then(() => this.onerror?.()); }
    });

    await expect(
      loadComparisonAssets('http://x.com/b.jpg', 'http://x.com/a.jpg'),
    ).rejects.toThrow();
  });
});
