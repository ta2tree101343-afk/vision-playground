export type ImageOperationType =
  | 'grayscale'
  | 'blur'
  | 'sharpen'
  | 'denoise'
  | 'edge_detection'
  | 'brightness'
  | 'contrast'
  | 'background_removal'
  | 'ocr'
  | 'object_detection'
  | 'caption_generation';

export type PipelineOperationType =
  | 'grayscale'
  | 'blur'
  | 'sharpen'
  | 'denoise'
  | 'edge_detection'
  | 'contrast'
  | 'background_removal'
  | 'object_detection'
  | 'caption_generation'
  | 'brightness';

export interface ImageOperationParameters {
  blur_strength?: number;
  brightness?: number;
  contrast?: number;
  sharpen_strength?: number;
  denoise_strength?: number;
  detection_threshold?: number;
}

export interface ImageOperationStep {
  operation: ImageOperationType;
  parameters?: ImageOperationParameters;
}

export interface ProcessImageRequest {
  file: File;
  operations: ImageOperationStep[];
}

export interface PipelineStep {
  operation: PipelineOperationType;
  parameters?: ImageOperationParameters;
}

export type PipelineInterpreterMode = 'rule_based' | 'llm';
export type PipelinePlanConfidence = 'high' | 'medium' | 'low';

export interface PipelinePlan {
  source_instruction: string;
  interpreter: PipelineInterpreterMode;
  summary: string;
  confidence: PipelinePlanConfidence;
  notes: string[];
  steps: PipelineStep[];
}

export interface PipelineInterpretRequest {
  instruction: string;
  mode?: PipelineInterpreterMode;
}

export interface PipelineInterpretResponse {
  plan: PipelinePlan;
}

export interface ProcessPipelineRequest {
  file: File;
  plan: PipelinePlan;
}

export interface ProcessImageResponse {
  message: string;
  original_image_url: string;
  processed_image_url: string;
  processed_filename: string;
  applied_operations: ImageOperationStep[];
  analysis?: ImageAnalysisResult | null;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ImageProcessJob {
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  filename: string;
  queue_position?: number | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  applied_operations: ImageOperationStep[];
  result?: ProcessImageResponse | null;
  error_message?: string | null;
}

export interface HealthResponse {
  status: string;
}

export interface ApiErrorBody {
  detail?: string | Array<{ msg?: string }>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrLine {
  text: string;
  confidence: number;
  bounding_box: BoundingBox;
}

export interface OcrResult {
  full_text: string;
  lines: OcrLine[];
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bounding_box: BoundingBox;
}

export interface ObjectDetectionResult {
  model: string;
  threshold: number;
  detections: DetectedObject[];
}

export interface BackgroundRemovalResult {
  foreground_ratio: number;
  mask_image_url?: string | null;
}

export interface CaptionCandidate {
  text: string;
  score: number;
}

export interface CaptionResult {
  candidates: CaptionCandidate[];
}

export interface ImageAnalysisResult {
  background_removal?: BackgroundRemovalResult | null;
  ocr?: OcrResult | null;
  object_detection?: ObjectDetectionResult | null;
  captions?: CaptionResult | null;
}
