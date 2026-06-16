import { describe, it, expect } from 'vitest';
import { toErrorMessage } from '@shared/lib/error';

describe('toErrorMessage', () => {
  it('returns the Error message when it is non-empty', () => {
    expect(toErrorMessage(new Error('something went wrong'))).toBe('something went wrong');
  });

  it('returns the fallback when the Error message is empty', () => {
    expect(toErrorMessage(new Error(''), 'fallback text')).toBe('fallback text');
  });

  it('returns the fallback when the Error message is only whitespace', () => {
    expect(toErrorMessage(new Error('   '), 'fallback text')).toBe('fallback text');
  });

  it('returns String(error) as the default fallback for non-Error values', () => {
    expect(toErrorMessage('raw string')).toBe('raw string');
  });

  it('returns the custom fallback for non-Error values', () => {
    expect(toErrorMessage(null, 'my fallback')).toBe('my fallback');
  });

  it('returns the custom fallback when value is undefined', () => {
    expect(toErrorMessage(undefined, 'oops')).toBe('oops');
  });

  it('returns the custom fallback when value is a plain object', () => {
    expect(toErrorMessage({ code: 42 }, 'default')).toBe('default');
  });

  it('prefers the Error message over the custom fallback', () => {
    expect(toErrorMessage(new Error('real message'), 'fallback')).toBe('real message');
  });
});
