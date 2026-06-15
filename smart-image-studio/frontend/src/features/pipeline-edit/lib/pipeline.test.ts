import { describe, it, expect } from 'vitest';
import { asUIThreshold } from '@entities/pipeline';
import { defaultParameterState } from '@entities/operation';
import { buildOperationStep, operationStepToTemplate } from './pipeline';

describe('buildOperationStep', () => {
  it('converts detectionThreshold from UI percent to API fraction', () => {
    const step = {
      id: 's1',
      operation: 'object_detection' as const,
      parameters: { ...defaultParameterState, detectionThreshold: asUIThreshold(70) },
    };
    expect(buildOperationStep(step).parameters?.detection_threshold).toBe(0.7);
  });

  it('throws RangeError when detectionThreshold is out of range', () => {
    const step = {
      id: 's2',
      operation: 'object_detection' as const,
      // bypass brand type to simulate corrupt restore
      parameters: { ...defaultParameterState, detectionThreshold: 5 as ReturnType<typeof asUIThreshold> },
    };
    expect(() => buildOperationStep(step)).toThrow(RangeError);
  });

  it('maps blur camelCase keys to snake_case', () => {
    const step = {
      id: 's3',
      operation: 'blur' as const,
      parameters: { ...defaultParameterState, blurStrength: 7, blurSigma: 1.5 },
    };
    expect(buildOperationStep(step).parameters).toEqual({ blur_strength: 7, blur_sigma: 1.5 });
  });

  it('returns no parameters for parameterless operations', () => {
    const step = {
      id: 's4',
      operation: 'grayscale' as const,
      parameters: defaultParameterState,
    };
    expect(buildOperationStep(step).parameters).toBeUndefined();
  });
});

describe('operationStepToTemplate', () => {
  it('converts detection_threshold fraction back to UI percent', () => {
    const template = operationStepToTemplate({
      operation: 'object_detection',
      parameters: { detection_threshold: 0.7 },
    });
    expect(template.parameters.detectionThreshold).toBe(70);
  });

  it('clamps very small fraction to UI minimum of 10', () => {
    const template = operationStepToTemplate({
      operation: 'object_detection',
      parameters: { detection_threshold: 0.001 },
    });
    expect(template.parameters.detectionThreshold).toBe(10);
  });

  it('fills missing parameters with defaults', () => {
    const template = operationStepToTemplate({
      operation: 'grayscale',
      parameters: undefined,
    });
    expect(template.parameters).toEqual(defaultParameterState);
  });
});
