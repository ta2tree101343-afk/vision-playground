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
import { normalizeProcessJob } from '@shared/lib/processResult';

function parseJob(raw: unknown): ImageProcessJob {
  return normalizeProcessJob(imageProcessJobSchema.parse(raw) as unknown as ImageProcessJob);
}

export async function createProcessJob(payload: ProcessImageRequest): Promise<ImageProcessJob> {
  if (payload.operations.length === 0) {
    throw new Error('画像処理には 1 つ以上の operation が必要です。');
  }
  const raw = await createProcessJobApiImagesJobsPost({
    file: payload.file,
    operations: JSON.stringify(payload.operations),
  });
  return parseJob(raw);
}

export async function fetchProcessJob(jobId: string): Promise<ImageProcessJob> {
  const raw = await getProcessJobApiImagesJobsJobIdGet(jobId, {
    signal: AbortSignal.timeout(10_000),
  });
  return parseJob(raw);
}

export async function fetchProcessJobs(): Promise<ImageProcessJob[]> {
  const raw = await listProcessJobsApiImagesJobsGet({ signal: AbortSignal.timeout(10_000) });
  return listJobsSchema.parse(raw as unknown).map((item) => parseJob(item as unknown));
}
