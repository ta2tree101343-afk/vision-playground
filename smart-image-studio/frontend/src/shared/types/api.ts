// Adapter over Orval-generated types.
// - Aliases generated names to the frontend names used throughout the codebase.
// - Keeps HealthResponse, ApiValidationErrorDetail, ApiErrorBody hand-written
//   (generated names and shapes differ from what apiClient.ts uses).
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

// Hand-written: generated HealthCheckResponse has { status: 'ok' } (literal);
// apiClient.ts uses { status: string } (wider type for future-proofing).
export interface HealthResponse {
  status: string;
}

// Hand-written: generated HTTPValidationError.detail is ValidationError[] only (no string branch).
// apiClient.ts uses the string branch for non-validation error responses.
export interface ApiValidationErrorDetail {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
}

export interface ApiErrorBody {
  detail?: string | ApiValidationErrorDetail[];
}

// Orval v8 does not generate a named union type — it inlines the union per-endpoint.
// Construct the discriminated union from the four generated variants.
export type ImageProcessJob =
  | QueuedJobResponse
  | RunningJobResponse
  | CompletedJobResponse
  | FailedJobResponse;

export type JobStatus = ImageProcessJob['status'];
