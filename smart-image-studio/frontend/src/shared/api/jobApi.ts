import type { ZodType } from 'zod';
import type { ImageProcessJob, ProcessImageRequest } from '@shared/types/api';
import {
  createProcessJobApiImagesJobsPost,
  listProcessJobsApiImagesJobsGet,
  getProcessJobApiImagesJobsJobIdGet,
} from '@shared/api/__generated__/api.types';
import {
  GetProcessJobApiImagesJobsJobIdGetResponse as imageProcessJobSchema,
  ListProcessJobsApiImagesJobsGetResponse as listJobsSchema,
} from '@shared/api/__generated__/api.schemas';
import { ApiError } from '@shared/api/apiClient';

const JOB_FETCH_TIMEOUT_MS = 10_000;

function parseWithSchema<T>(schema: ZodType<T>, raw: unknown): T {
  try {
    return schema.parse(raw);
  } catch (error) {
    throw new ApiError('サーバーのレスポンス形式が不正です。', 0, error);
  }
}

export async function createProcessJob(payload: ProcessImageRequest): Promise<ImageProcessJob> {
  if (payload.operations.length === 0) {
    throw new Error('画像処理には 1 つ以上の operation が必要です。');
  }
  const { data } = await createProcessJobApiImagesJobsPost({
    file: payload.file,
    operations: JSON.stringify(payload.operations),
  });
  return parseWithSchema(imageProcessJobSchema, data);
}

export async function fetchProcessJob(jobId: string): Promise<ImageProcessJob> {
  const { data } = await getProcessJobApiImagesJobsJobIdGet(jobId, {
    signal: AbortSignal.timeout(JOB_FETCH_TIMEOUT_MS),
  });
  return parseWithSchema(imageProcessJobSchema, data);
}

export async function fetchProcessJobs(): Promise<ImageProcessJob[]> {
  const { data } = await listProcessJobsApiImagesJobsGet({
    signal: AbortSignal.timeout(JOB_FETCH_TIMEOUT_MS),
  });
  return parseWithSchema(listJobsSchema, data);
}
