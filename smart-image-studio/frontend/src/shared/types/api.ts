// Adapter over Orval-generated types.
// - Aliases generated names to the frontend names used throughout the codebase.
// - Keeps ApiErrorBody hand-written (used by apiClient.ts for error message extraction).
// - Keeps ProcessImageRequest hand-written (form upload — not an OpenAPI schema component).
export type {
  OperationType,
  ProcessImageResponse,
  BoundingBox,
  OcrLine,
  OcrResult,
  DetectedObject,
  ObjectDetectionResult,
  BackgroundRemovalResult,
  CaptionCandidate,
  CaptionResult,
  ImageAnalysisResult,
} from '@shared/api/__generated__/api.types';

// Aliases: backend model names → shorter frontend names
export type { ImageOperationParameters as OperationParameters } from '@shared/api/__generated__/api.types';
export type { ImageOperationStep as OperationStep } from '@shared/api/__generated__/api.types';

import type {
  QueuedJobResponse,
  RunningJobResponse,
  CompletedJobResponse,
  FailedJobResponse,
  ImageOperationStep,
} from '@shared/api/__generated__/api.types';

// Hand-written: form upload type — not an OpenAPI schema component
export interface ProcessImageRequest {
  file: File;
  operations: ImageOperationStep[];
}

// Hand-written: used by apiClient.ts to extract error messages from API error responses
export interface ApiErrorBody {
  detail?: string | ApiValidationErrorDetail[];
}

interface ApiValidationErrorDetail {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
}

// Orval v8 does not generate a named union type — it inlines the union per-endpoint.
// Construct the discriminated union from the four generated variants.
export type ImageProcessJob =
  | QueuedJobResponse
  | RunningJobResponse
  | CompletedJobResponse
  | FailedJobResponse;

export type JobStatus = ImageProcessJob['status'];
