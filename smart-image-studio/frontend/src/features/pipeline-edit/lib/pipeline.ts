import type { OperationParameters, OperationType, OperationStep } from '@shared/types/api';
import { asUIThreshold, type ParameterState, type PipelineStepDraft, type PipelineStepTemplate, type UIThresholdPercent } from '@entities/pipeline/model/pipeline.types';
import { defaultParameterState, parameterConstraints } from '@features/operation-select/config/imageOperations';
import { createId } from '@shared/lib/id';

export function createPipelineStep(
  operation: OperationType,
  overrides: Partial<ParameterState> = {},
): PipelineStepDraft {
  return {
    id: createId('step'),
    operation,
    parameters: { ...defaultParameterState, ...overrides },
  };
}

export function clonePipelineTemplates(steps: PipelineStepTemplate[]): PipelineStepDraft[] {
  return steps.map((step) => createPipelineStep(step.operation, step.parameters));
}

export function toPipelineTemplates(steps: PipelineStepDraft[]): PipelineStepTemplate[] {
  return steps.map((step) => ({
    operation: step.operation,
    parameters: { ...step.parameters },
  }));
}

function toUiDetectionThreshold(value: number | null | undefined): UIThresholdPercent {
  if (value == null) return defaultParameterState.detectionThreshold;
  const percentage = value <= 1 ? value * 100 : value;
  return asUIThreshold(Math.min(95, Math.max(10, Math.round(percentage))));
}

const parameterBuilders: Partial<Record<OperationType, (p: ParameterState) => OperationParameters>> = {
  blur:             (p) => ({ blur_strength: p.blurStrength, blur_sigma: p.blurSigma }),
  brightness:       (p) => ({ brightness: p.brightness }),
  contrast:         (p) => ({ contrast: p.contrast }),
  sharpen:          (p) => ({ sharpen_strength: p.sharpenStrength }),
  denoise:          (p) => ({ denoise_strength: p.denoiseStrength }),
  object_detection: (p) => {
    const { min, max } = parameterConstraints.detectionThreshold;
    if (p.detectionThreshold < min || p.detectionThreshold > max) {
      throw new RangeError(`detectionThreshold out of range: ${p.detectionThreshold} (expected ${min}–${max})`);
    }
    return { detection_threshold: p.detectionThreshold / 100 };
  },
};

export function buildOperationStep(step: PipelineStepDraft): OperationStep {
  const builder = parameterBuilders[step.operation];
  return {
    operation: step.operation,
    parameters: builder ? builder(step.parameters) : undefined,
  };
}

export function operationStepToTemplate(step: OperationStep): PipelineStepTemplate {
  return {
    operation: step.operation,
    parameters: {
      ...defaultParameterState,
      blurStrength: step.parameters?.blur_strength ?? defaultParameterState.blurStrength,
      blurSigma: step.parameters?.blur_sigma ?? defaultParameterState.blurSigma,
      brightness: step.parameters?.brightness ?? defaultParameterState.brightness,
      contrast: step.parameters?.contrast ?? defaultParameterState.contrast,
      sharpenStrength: step.parameters?.sharpen_strength ?? defaultParameterState.sharpenStrength,
      denoiseStrength: step.parameters?.denoise_strength ?? defaultParameterState.denoiseStrength,
      detectionThreshold: toUiDetectionThreshold(step.parameters?.detection_threshold),
    },
  };
}


export function movePipelineStep(
  steps: PipelineStepDraft[],
  stepId: string,
  direction: 'up' | 'down',
): PipelineStepDraft[] {
  const currentIndex = steps.findIndex((step) => step.id === stepId);

  if (currentIndex === -1) {
    return steps;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= steps.length) {
    return steps;
  }

  const reordered = [...steps];
  const [movedStep] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, movedStep);
  return reordered;
}
