import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentPath, navigateTo } from '@shared/lib/navigation';

beforeEach(() => {
  vi.spyOn(window.history, 'pushState');
  vi.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  vi.restoreAllMocks();
  // Reset location to '/' after each test.
  window.history.pushState({}, '', '/');
});

describe('getCurrentPath', () => {
  it('returns "/" when pathname is "/"', () => {
    window.history.pushState({}, '', '/');
    expect(getCurrentPath()).toBe('/');
  });

  it('returns "/result" when pathname is "/result"', () => {
    window.history.pushState({}, '', '/result');
    expect(getCurrentPath()).toBe('/result');
  });

  it('returns "/" for any unrecognised path', () => {
    window.history.pushState({}, '', '/unknown');
    expect(getCurrentPath()).toBe('/');
  });
});

describe('navigateTo', () => {
  it('calls pushState when navigating to a new path', () => {
    window.history.pushState({}, '', '/');
    navigateTo('/result');
    expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/result');
  });

  it('does not call pushState when already on the target path', () => {
    window.history.pushState({}, '', '/result');
    vi.mocked(window.history.pushState).mockClear();
    navigateTo('/result');
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it('calls replaceState when replace=true', () => {
    window.history.pushState({}, '', '/');
    navigateTo('/result', true);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/result');
  });

  it('dispatches a "popstate" event after navigation', () => {
    window.history.pushState({}, '', '/');
    const listener = vi.fn();
    window.addEventListener('popstate', listener);
    navigateTo('/result');
    window.removeEventListener('popstate', listener);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('dispatches popstate even when replace=true', () => {
    window.history.pushState({}, '', '/');
    const listener = vi.fn();
    window.addEventListener('popstate', listener);
    navigateTo('/result', true);
    window.removeEventListener('popstate', listener);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('still calls replaceState when already on the same path with replace=true', () => {
    window.history.pushState({}, '', '/result');
    vi.mocked(window.history.pushState).mockClear();
    navigateTo('/result', true);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/result');
    expect(window.history.pushState).not.toHaveBeenCalled();
  });
});
