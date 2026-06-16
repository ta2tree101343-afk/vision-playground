import { describe, it, expect } from 'vitest';
import { builtInPipelinePresets } from '@features/pipeline-edit/config/pipelinePresets';
import { parameterConstraints } from '@entities/operation/config/operations';
import type { ParameterKey } from '@entities/pipeline';

describe('builtInPipelinePresets', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(builtInPipelinePresets)).toBe(true);
    expect(builtInPipelinePresets.length).toBeGreaterThan(0);
  });

  it('every preset has required string fields', () => {
    for (const preset of builtInPipelinePresets) {
      expect(typeof preset.id).toBe('string');
      expect(typeof preset.name).toBe('string');
      expect(typeof preset.description).toBe('string');
    }
  });

  it('every preset has builtIn: true', () => {
    for (const preset of builtInPipelinePresets) {
      expect(preset.builtIn).toBe(true);
    }
  });

  it('every preset id starts with "builtin-"', () => {
    for (const preset of builtInPipelinePresets) {
      expect(preset.id).toMatch(/^builtin-/);
    }
  });

  it('all preset ids are unique', () => {
    const ids = builtInPipelinePresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has at least one step', () => {
    for (const preset of builtInPipelinePresets) {
      expect(preset.steps.length).toBeGreaterThan(0);
    }
  });

  it('every step has a non-empty operation string', () => {
    for (const preset of builtInPipelinePresets) {
      for (const step of preset.steps) {
        expect(typeof step.operation).toBe('string');
        expect(step.operation.length).toBeGreaterThan(0);
      }
    }
  });

  it('every step parameter value is within its defined constraint range', () => {
    for (const preset of builtInPipelinePresets) {
      for (const step of preset.steps) {
        for (const [key, value] of Object.entries(step.parameters)) {
          if (!(key in parameterConstraints)) continue;
          const { min, max } = parameterConstraints[key as ParameterKey];
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('integer-only parameters contain only integers', () => {
    for (const preset of builtInPipelinePresets) {
      for (const step of preset.steps) {
        for (const [key, value] of Object.entries(step.parameters)) {
          if (!(key in parameterConstraints)) continue;
          const constraint = parameterConstraints[key as ParameterKey];
          if (constraint.integer) {
            expect(Number.isInteger(value)).toBe(true);
          }
        }
      }
    }
  });

  it('odd-constrained parameters (blurStrength) are odd numbers', () => {
    for (const preset of builtInPipelinePresets) {
      for (const step of preset.steps) {
        const value = step.parameters.blurStrength;
        if (value !== undefined) {
          expect(value % 2).toBe(1);
        }
      }
    }
  });

  it('detectionThreshold is an integer in [10, 95] when present', () => {
    for (const preset of builtInPipelinePresets) {
      for (const step of preset.steps) {
        if (step.operation === 'object_detection') {
          const threshold = step.parameters.detectionThreshold;
          expect(Number.isInteger(threshold)).toBe(true);
          expect(threshold).toBeGreaterThanOrEqual(10);
          expect(threshold).toBeLessThanOrEqual(95);
        }
      }
    }
  });

  it('preset names and descriptions are non-empty strings', () => {
    for (const preset of builtInPipelinePresets) {
      expect(preset.name.trim().length).toBeGreaterThan(0);
      expect(preset.description.trim().length).toBeGreaterThan(0);
    }
  });
});
