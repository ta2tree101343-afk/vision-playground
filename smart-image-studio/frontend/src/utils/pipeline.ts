import type { ImageOperationStep, ImageOperationType, PipelinePlan, PipelineStep } from '../types/api';
import type { PipelineStepDraft, PipelineStepTemplate } from '../types/image';
import { defaultParameterState } from '../config/imageOperations';

function createStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPipelineStep(
  operation: ImageOperationType,
  overrides: Partial<PipelineStepTemplate['parameters']> = {},
): PipelineStepDraft {
  return {
    id: createStepId(),
    operation,
    parameters: {
      ...defaultParameterState,
      ...overrides,
    },
  };
}

export function clonePipelineTemplate(step: PipelineStepTemplate): PipelineStepDraft {
  return createPipelineStep(step.operation, step.parameters);
}

export function clonePipelineTemplates(steps: PipelineStepTemplate[]): PipelineStepDraft[] {
  return steps.map(clonePipelineTemplate);
}

export function toPipelineTemplates(steps: PipelineStepDraft[]): PipelineStepTemplate[] {
  return steps.map((step) => ({
    operation: step.operation,
    parameters: { ...step.parameters },
  }));
}

export function buildOperationStep(step: PipelineStepDraft): ImageOperationStep {
  switch (step.operation) {
    case 'blur':
      return {
        operation: step.operation,
        parameters: {
          blur_strength: step.parameters.blurStrength,
        },
      };
    case 'brightness':
      return {
        operation: step.operation,
        parameters: {
          brightness: step.parameters.brightness,
        },
      };
    case 'contrast':
      return {
        operation: step.operation,
        parameters: {
          contrast: step.parameters.contrast,
        },
      };
    case 'sharpen':
      return {
        operation: step.operation,
        parameters: {
          sharpen_strength: step.parameters.sharpenStrength,
        },
      };
    case 'denoise':
      return {
        operation: step.operation,
        parameters: {
          denoise_strength: step.parameters.denoiseStrength,
        },
      };
    case 'object_detection':
      return {
        operation: step.operation,
        parameters: {
          detection_threshold: step.parameters.detectionThreshold / 100,
        },
      };
    default:
      return { operation: step.operation };
  }
}

export function pipelinePlanStepToTemplate(step: PipelineStep): PipelineStepTemplate {
  return {
    operation: step.operation as ImageOperationType,
    parameters: {
      ...defaultParameterState,
      blurStrength: step.parameters?.blur_strength ?? defaultParameterState.blurStrength,
      brightness: step.parameters?.brightness ?? defaultParameterState.brightness,
      contrast: step.parameters?.contrast ?? defaultParameterState.contrast,
      sharpenStrength: step.parameters?.sharpen_strength ?? defaultParameterState.sharpenStrength,
      denoiseStrength: step.parameters?.denoise_strength ?? defaultParameterState.denoiseStrength,
      detectionThreshold: Math.round(
        (step.parameters?.detection_threshold ?? defaultParameterState.detectionThreshold / 100) * 100,
      ),
    },
  };
}

export function pipelinePlanToTemplates(plan: PipelinePlan): PipelineStepTemplate[] {
  return plan.steps.map(pipelinePlanStepToTemplate);
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
