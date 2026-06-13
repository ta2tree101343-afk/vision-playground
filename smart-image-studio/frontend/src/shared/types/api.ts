// Adapter over Orval-generated types.
// - Aliases generated names to the frontend names used throughout the codebase.
// - Overrides ImageProcessJob with a discriminated union (the backend model is flat).
// - Keeps HealthResponse, ApiValidationErrorDetail, ApiErrorBody, OperationParameters,
//   OperationStep, and ProcessImageRequest hand-written (shape mismatches or not in OpenAPI spec).
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

import type { OperationType, ProcessImageResponse } from '@shared/api/__generated__/api.types';

// Hand-written: OperationParameters typed as { [key: string]: unknown } in generated file,
// because Pydantic model_serializer collapses the schema in OpenAPI.
export interface OperationParameters {
  blur_strength?: number | null;
  blur_sigma?: number | null;
  brightness?: number | null;
  contrast?: number | null;
  sharpen_strength?: number | null;
  denoise_strength?: number | null;
  detection_threshold?: number | null;
}

// Hand-written: ImageOperationStep.parameters is { [key: string]: unknown } in generated,
// which loses field-level type safety. Defined here to use the typed OperationParameters.
export interface OperationStep {
  operation: OperationType;
  parameters?: OperationParameters;
}

// Hand-written: form upload type — not an OpenAPI schema component
export interface ProcessImageRequest {
  file: File;
  operations: OperationStep[];
}

// Hand-written: generated name is HealthCheckResponse (shape is compatible but name differs)
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

// Override: backend Pydantic model is flat, Orval cannot derive the discriminated union.
interface ImageProcessJobBase {
  job_id: string;
  progress: number;
  message: string;
  filename: string;
  created_at: string;
  applied_operations: OperationStep[];
}

export type ImageProcessJob =
  | (ImageProcessJobBase & {
      status: 'queued';
      queue_position?: number | null;
      started_at?: null;
      completed_at?: null;
      result?: null;
      error_message?: null;
    })
  | (ImageProcessJobBase & {
      status: 'running';
      started_at: string;
      queue_position?: null;
      completed_at?: null;
      result?: null;
      error_message?: null;
    })
  | (ImageProcessJobBase & {
      status: 'completed';
      started_at: string;
      completed_at: string;
      result: ProcessImageResponse;
      queue_position?: null;
      error_message?: null;
    })
  | (ImageProcessJobBase & {
      status: 'failed';
      started_at: string;
      completed_at: string;
      error_message: string;
      queue_position?: null;
      result?: null;
    });

export type JobStatus = ImageProcessJob['status'];
