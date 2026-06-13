import { apiClient } from '@shared/api/apiClient';
import type { ImageProcessJob, ProcessImageRequest } from '@shared/types/api';
import { ImageProcessJob as imageProcessJobSchema } from '@shared/api/__generated__/api.schemas';
import { normalizeProcessJob } from '@shared/lib/processResult';

function parseJob(raw: unknown): ImageProcessJob {
  return normalizeProcessJob(imageProcessJobSchema.parse(raw) as unknown as ImageProcessJob);
}

const processImageJobsPath = '/api/images/jobs';

export async function createProcessJob(payload: ProcessImageRequest): Promise<ImageProcessJob> {
  if (payload.operations.length === 0) {
    throw new Error('画像処理には 1 つ以上の operation が必要です。');
  }

  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('operations', JSON.stringify(payload.operations));

  const raw = await apiClient.request<unknown, FormData>({
    path: processImageJobsPath,
    method: 'POST',
    body: formData,
  });

  return parseJob(raw);
}

export async function fetchProcessJob(jobId: string): Promise<ImageProcessJob> {
  const raw = await apiClient.request<unknown>({
    path: `${processImageJobsPath}/${encodeURIComponent(jobId)}`,
    timeoutMs: 10_000,
  });

  return parseJob(raw);
}

export async function fetchProcessJobs(): Promise<ImageProcessJob[]> {
  const raw = await apiClient.request<unknown[]>({
    path: processImageJobsPath,
    timeoutMs: 10_000,
  });

  return raw.map(parseJob);
}
