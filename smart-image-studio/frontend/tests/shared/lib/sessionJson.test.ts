import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSessionJson, writeSessionJson, removeSessionItem } from '@shared/lib/sessionJson';
import { getSessionStorage } from '@shared/lib/browser';

vi.mock('@shared/lib/browser', () => ({
  getSessionStorage: vi.fn(),
}));

const mockGetSessionStorage = vi.mocked(getSessionStorage);

function makeMockStorage() {
  return {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readSessionJson', () => {
  it('returns null when storage is unavailable (SSR)', () => {
    mockGetSessionStorage.mockReturnValue(null);
    expect(readSessionJson('key', 'test')).toBeNull();
  });

  it('returns null when the key does not exist', () => {
    const storage = makeMockStorage();
    storage.getItem.mockReturnValue(null);
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(readSessionJson('key', 'test')).toBeNull();
  });

  it('returns parsed value for valid JSON', () => {
    const storage = makeMockStorage();
    storage.getItem.mockReturnValue(JSON.stringify({ foo: 'bar' }));
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(readSessionJson<{ foo: string }>('key', 'test')).toEqual({ foo: 'bar' });
  });

  it('returns null and removes the item on JSON parse failure', () => {
    const storage = makeMockStorage();
    storage.getItem.mockReturnValue('not-valid-json{{{');
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    const result = readSessionJson('key', 'test');

    expect(result).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('key');
  });

  it('re-throws SecurityError from getItem', () => {
    const storage = makeMockStorage();
    const securityError = new DOMException('blocked', 'SecurityError');
    storage.getItem.mockImplementation(() => { throw securityError; });
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(() => readSessionJson('key', 'test')).toThrow(securityError);
  });

  it('returns null (does not throw) for non-SecurityError from getItem', () => {
    const storage = makeMockStorage();
    storage.getItem.mockImplementation(() => { throw new Error('quota exceeded'); });
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(readSessionJson('key', 'test')).toBeNull();
  });
});

describe('writeSessionJson', () => {
  it('returns true on successful write', () => {
    const storage = makeMockStorage();
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(writeSessionJson('key', { x: 1 }, 'test')).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('key', JSON.stringify({ x: 1 }));
  });

  it('returns false when setItem throws', () => {
    const storage = makeMockStorage();
    storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(writeSessionJson('key', { x: 1 }, 'test')).toBe(false);
  });

  it('does not throw when storage is null', () => {
    mockGetSessionStorage.mockReturnValue(null);
    expect(writeSessionJson('key', {}, 'test')).toBe(true);
  });
});

describe('removeSessionItem', () => {
  it('calls removeItem on the storage', () => {
    const storage = makeMockStorage();
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    removeSessionItem('key', 'test');

    expect(storage.removeItem).toHaveBeenCalledWith('key');
  });

  it('silently ignores SecurityError', () => {
    const storage = makeMockStorage();
    storage.removeItem.mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(() => removeSessionItem('key', 'test')).not.toThrow();
  });

  it('does not throw for other errors', () => {
    const storage = makeMockStorage();
    storage.removeItem.mockImplementation(() => { throw new Error('unexpected'); });
    mockGetSessionStorage.mockReturnValue(storage as unknown as Storage);

    expect(() => removeSessionItem('key', 'test')).not.toThrow();
  });

  it('does not throw when storage is null', () => {
    mockGetSessionStorage.mockReturnValue(null);
    expect(() => removeSessionItem('key', 'test')).not.toThrow();
  });
});
