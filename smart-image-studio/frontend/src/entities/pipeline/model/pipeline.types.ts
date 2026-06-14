import type { OperationType } from '@shared/types/api';

/**
 * Object detection threshold stored in UI units: integer percentage [10, 95].
 * Must be divided by 100 before sending to the API (`OperationParameters.detection_threshold`).
 * Use `toApiThreshold` / `toUiThreshold` in pipeline.ts to cross the boundary.
 */
declare const __uiThresholdBrand: unique symbol;
export type UIThresholdPercent = number & { readonly [__uiThresholdBrand]: 'UIThresholdPercent' };

/** Converts an API fraction (0.1–0.95) or plain percentage (10–95) to `UIThresholdPercent`. */
export function asUIThreshold(value: number): UIThresholdPercent {
  if (!Number.isInteger(value) || value < 10 || value > 95) {
    throw new RangeError(`UIThresholdPercent must be an integer in [10, 95], got ${value}`);
  }
  return value as UIThresholdPercent;
}

export type ParameterKey = keyof ParameterState;

export interface ParameterState {
  /** Blur kernel size. Range: [1, 25] (odd integers recommended). */
  blurStrength: number;
  /** Gaussian sigma for blur. `0` = auto-compute from kernel size. Range: [0.0, 10.0]. */
  blurSigma: number;
  /** Brightness adjustment. Range: [-100, 100], `0` = no change. */
  brightness: number;
  /** Contrast adjustment. Range: [-100, 100], `0` = no change. */
  contrast: number;
  /** Sharpen intensity. Range: [1, 5]. */
  sharpenStrength: number;
  /** Denoise intensity. Range: [1, 30]. */
  denoiseStrength: number;
  /**
   * Object detection confidence threshold in percentage units. Range: [10, 95].
   * Stored as percentage (e.g. `45` = 45%). Converted to fraction (`/ 100`) before sending to the API.
   * See `OperationParameters.detection_threshold` for the API-side representation.
   */
  detectionThreshold: UIThresholdPercent;
}

export interface PipelineStepTemplate {
  operation: OperationType;
  parameters: ParameterState;
}

export interface PipelineStepDraft extends PipelineStepTemplate {
  id: string;
}

export interface PipelinePreset {
  id: string;
  name: string;
  description: string;
  steps: PipelineStepTemplate[];
  builtIn?: boolean;
}

export interface SavedPipelineDraft {
  steps: PipelineStepTemplate[];
  updatedAt: string;
}
