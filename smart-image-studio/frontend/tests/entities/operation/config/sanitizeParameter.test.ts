import { describe, it, expect } from 'vitest';
import { sanitizeParameter, defaultParameterState } from '@entities/operation/config/operations';

describe('sanitizeParameter', () => {
  describe('type / finiteness guard', () => {
    it('returns default when value is a string', () => {
      expect(sanitizeParameter('brightness', '50' as unknown as number)).toBe(defaultParameterState.brightness);
    });

    it('returns default when value is null', () => {
      expect(sanitizeParameter('brightness', null as unknown as number)).toBe(defaultParameterState.brightness);
    });

    it('returns default when value is NaN', () => {
      expect(sanitizeParameter('brightness', NaN)).toBe(defaultParameterState.brightness);
    });

    it('returns default when value is Infinity', () => {
      expect(sanitizeParameter('brightness', Infinity)).toBe(defaultParameterState.brightness);
    });

    it('returns default when value is -Infinity', () => {
      expect(sanitizeParameter('brightness', -Infinity)).toBe(defaultParameterState.brightness);
    });
  });

  describe('range guard', () => {
    it('returns default when value is below min (brightness)', () => {
      expect(sanitizeParameter('brightness', -101)).toBe(defaultParameterState.brightness);
    });

    it('returns default when value is above max (brightness)', () => {
      expect(sanitizeParameter('brightness', 101)).toBe(defaultParameterState.brightness);
    });

    it('accepts the exact min boundary', () => {
      expect(sanitizeParameter('brightness', -100)).toBe(-100);
    });

    it('accepts the exact max boundary', () => {
      expect(sanitizeParameter('brightness', 100)).toBe(100);
    });

    it('accepts a value in the middle of the range', () => {
      expect(sanitizeParameter('brightness', 50)).toBe(50);
    });
  });

  describe('integer guard', () => {
    it('returns default when a float is given for an integer-only key (sharpenStrength)', () => {
      expect(sanitizeParameter('sharpenStrength', 1.5)).toBe(defaultParameterState.sharpenStrength);
    });

    it('accepts an integer for an integer-only key', () => {
      expect(sanitizeParameter('sharpenStrength', 3)).toBe(3);
    });

    it('accepts a float for a non-integer key (blurSigma)', () => {
      expect(sanitizeParameter('blurSigma', 2.5)).toBe(2.5);
    });
  });

  describe('odd guard (blurStrength)', () => {
    it('returns default for even value that cannot snap within max', () => {
      // All even numbers in [1,25] snap to an odd ≤ 25, so test that snap works
      expect(sanitizeParameter('blurStrength', 4)).toBe(5);
    });

    it('snaps even value to value + 1 when the result is within max', () => {
      expect(sanitizeParameter('blurStrength', 2)).toBe(3);
    });

    it('snaps even value 24 to 25 (boundary snap)', () => {
      expect(sanitizeParameter('blurStrength', 24)).toBe(25);
    });

    it('accepts an odd value without modification', () => {
      expect(sanitizeParameter('blurStrength', 7)).toBe(7);
    });

    it('returns default when value is below min', () => {
      expect(sanitizeParameter('blurStrength', 0)).toBe(defaultParameterState.blurStrength);
    });
  });

  describe('valid values pass through unchanged', () => {
    it('blurSigma 0 is valid (min boundary)', () => {
      expect(sanitizeParameter('blurSigma', 0)).toBe(0);
    });

    it('denoiseStrength 15 is valid', () => {
      expect(sanitizeParameter('denoiseStrength', 15)).toBe(15);
    });

    it('detectionThreshold 50 is valid', () => {
      expect(sanitizeParameter('detectionThreshold', 50)).toBe(50);
    });

    it('contrast -50 is valid', () => {
      expect(sanitizeParameter('contrast', -50)).toBe(-50);
    });
  });
});
