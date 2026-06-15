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

function parseJob(raw: unknown): ImageProcessJob {
  try {
    return imageProcessJobSchema.parse(raw) as unknown as ImageProcessJob;
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
  return parseJob(data as unknown);
}

export async function fetchProcessJob(jobId: string): Promise<ImageProcessJob> {
  const { data } = await getProcessJobApiImagesJobsJobIdGet(jobId, {
    signal: AbortSignal.timeout(10_000),
  });
  return parseJob(data as unknown);
}

export async function fetchProcessJobs(): Promise<ImageProcessJob[]> {
  const { data } = await listProcessJobsApiImagesJobsGet({ signal: AbortSignal.timeout(10_000) });
  try {
    return listJobsSchema.parse(data as unknown).map((item) => parseJob(item as unknown));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('サーバーのレスポンス形式が不正です。', 0, error);
  }
}
