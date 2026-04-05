import { apiClient } from './apiClient';
import type {
  HealthResponse,
  ImageProcessJob,
  ProcessImageRequest,
  ProcessImageResponse,
} from '../types/api';
import { normalizeProcessJob, normalizeProcessResult } from '../utils/processResult';

const healthPath = '/health';
const processImagePath = '/api/images/process';
const processImageJobsPath = '/api/images/jobs';

export async function fetchHealth(): Promise<HealthResponse> {
  return apiClient.request<HealthResponse>({ path: healthPath });
}

export async function processImage(payload: ProcessImageRequest): Promise<ProcessImageResponse> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('operations', JSON.stringify(payload.operations));

  const response = await apiClient.request<ProcessImageResponse, FormData>({
    path: processImagePath,
    method: 'POST',
    body: formData,
  });

  return normalizeProcessResult(response);
}

export async function createProcessJob(payload: ProcessImageRequest): Promise<ImageProcessJob> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('operations', JSON.stringify(payload.operations));

  const response = await apiClient.request<ImageProcessJob, FormData>({
    path: processImageJobsPath,
    method: 'POST',
    body: formData,
  });

  return normalizeProcessJob(response);
}

export async function fetchProcessJob(jobId: string): Promise<ImageProcessJob> {
  const response = await apiClient.request<ImageProcessJob>({
    path: `${processImageJobsPath}/${jobId}`,
  });

  return normalizeProcessJob(response);
}

export async function fetchProcessJobs(): Promise<ImageProcessJob[]> {
  const response = await apiClient.request<ImageProcessJob[]>({
    path: processImageJobsPath,
  });

  return response.map(normalizeProcessJob);
}

export async function downloadProcessedImage(imageUrl: string): Promise<Blob> {
  return apiClient.download(imageUrl);
}
