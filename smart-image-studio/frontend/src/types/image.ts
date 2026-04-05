import type {
  ImageOperationType,
  ImageProcessJob,
  PipelineInterpreterMode,
  PipelinePlan,
  ProcessImageResponse,
} from './api';

export type ParameterKey =
  | 'blurStrength'
  | 'brightness'
  | 'contrast'
  | 'sharpenStrength'
  | 'denoiseStrength'
  | 'detectionThreshold';

export interface ParameterDefinition {
  key: ParameterKey;
  label: string;
  min: number;
  max: number;
  step: number;
  helpText: string;
}

export interface OperationOption {
  value: ImageOperationType;
  label: string;
  description: string;
  icon: string;
  parameters: ParameterDefinition[];
}

export interface ParameterState {
  blurStrength: number;
  brightness: number;
  contrast: number;
  sharpenStrength: number;
  denoiseStrength: number;
  detectionThreshold: number;
}

export interface PipelineStepTemplate {
  operation: ImageOperationType;
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

export interface StudioViewState {
  selectedFile: File | null;
  previewUrl: string | null;
  pipelineSteps: PipelineStepDraft[];
  result: ProcessImageResponse | null;
  activeJob: ImageProcessJob | null;
  jobHistory: ImageProcessJob[];
  isProcessing: boolean;
  errorMessage: string | null;
}

export interface StudioPlannerState {
  instruction: string;
  interpretedPlan: PipelinePlan | null;
  isInterpreting: boolean;
}

export interface PlannerHistoryEntry {
  id: string;
  createdAt: string;
  mode: PipelineInterpreterMode;
  instruction: string;
  plan: PipelinePlan;
}
