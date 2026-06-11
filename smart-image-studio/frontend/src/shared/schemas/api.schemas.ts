import { z } from 'zod';

const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const ocrLineSchema = z.object({
  text: z.string(),
  confidence: z.number(),
  bounding_box: boundingBoxSchema,
});

const detectedObjectSchema = z.object({
  label: z.string(),
  confidence: z.number(),
  bounding_box: boundingBoxSchema,
});

const captionCandidateSchema = z.object({
  text: z.string(),
  score: z.number(),
});

const imageAnalysisResultSchema = z.object({
  background_removal: z
    .object({ foreground_ratio: z.number(), mask_image_url: z.string().nullable().optional() })
    .nullable()
    .optional(),
  ocr: z
    .object({ full_text: z.string(), lines: z.array(ocrLineSchema) })
    .nullable()
    .optional(),
  object_detection: z
    .object({
      model: z.string(),
      threshold: z.number(),
      detections: z.array(detectedObjectSchema),
    })
    .nullable()
    .optional(),
  captions: z.object({ candidates: z.array(captionCandidateSchema) }).nullable().optional(),
});

const operationTypeSchema = z.enum([
  'grayscale', 'blur', 'sharpen', 'denoise', 'edge_detection',
  'brightness', 'contrast', 'background_removal', 'ocr',
  'object_detection', 'caption_generation',
]);

const operationParametersSchema = z.object({
  blur_strength: z.number().int().min(1).max(25).nullish(),
  blur_sigma: z.number().min(0).max(10).nullish(),
  brightness: z.number().int().min(-100).max(100).nullish(),
  contrast: z.number().int().min(-100).max(100).nullish(),
  sharpen_strength: z.number().int().min(1).max(5).nullish(),
  denoise_strength: z.number().int().min(1).max(30).nullish(),
  detection_threshold: z.number().min(0.1).max(0.95).nullish(),
}).strict();

const operationStepSchema = z.object({
  operation: operationTypeSchema,
  parameters: operationParametersSchema.optional(),
}).strict();

export const processImageResponseSchema = z.object({
  message: z.string(),
  original_image_url: z.string(),
  processed_image_url: z.string(),
  processed_filename: z.string(),
  applied_operations: z.array(operationStepSchema),
  analysis: imageAnalysisResultSchema.nullable().optional(),
});

const jobBaseSchema = z.object({
  job_id: z.string(),
  progress: z.number(),
  message: z.string(),
  filename: z.string(),
  created_at: z.string(),
  applied_operations: z.array(operationStepSchema),
});

export const imageProcessJobSchema = z.discriminatedUnion('status', [
  jobBaseSchema.extend({
    status: z.literal('queued'),
    queue_position: z.number().optional(),
    started_at: z.null().optional(),
    completed_at: z.null().optional(),
    result: z.null().optional(),
    error_message: z.null().optional(),
  }),
  jobBaseSchema.extend({
    status: z.literal('running'),
    started_at: z.string(),
    queue_position: z.null().optional(),
    completed_at: z.null().optional(),
    result: z.null().optional(),
    error_message: z.null().optional(),
  }),
  jobBaseSchema.extend({
    status: z.literal('completed'),
    started_at: z.string(),
    completed_at: z.string(),
    result: processImageResponseSchema,
    queue_position: z.null().optional(),
    error_message: z.null().optional(),
  }),
  jobBaseSchema.extend({
    status: z.literal('failed'),
    started_at: z.string(),
    completed_at: z.string(),
    error_message: z.string(),
    queue_position: z.null().optional(),
    result: z.null().optional(),
  }),
]);
