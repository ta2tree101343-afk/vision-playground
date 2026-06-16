import { describe, it, expect } from 'vitest';
import { createId } from '@shared/lib/id';

describe('createId', () => {
  it('returns a string', () => {
    expect(typeof createId('step')).toBe('string');
  });

  it('starts with the given prefix followed by a dash', () => {
    expect(createId('step')).toMatch(/^step-/);
  });

  it('uses the prefix as-is', () => {
    expect(createId('my-prefix')).toMatch(/^my-prefix-/);
  });

  it('returns a different value on each call', () => {
    const a = createId('x');
    const b = createId('x');
    expect(a).not.toBe(b);
  });

  it('different prefixes produce different ids', () => {
    const a = createId('foo');
    const b = createId('bar');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^foo-/);
    expect(b).toMatch(/^bar-/);
  });

  it('produces ids with sufficient length', () => {
    expect(createId('step').length).toBeGreaterThan(5);
  });
});
