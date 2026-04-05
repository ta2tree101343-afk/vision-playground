import { apiClient } from './apiClient';
import type {
  PipelineInterpretRequest,
  PipelineInterpretResponse,
  ProcessImageResponse,
  ProcessPipelineRequest,
} from '../types/api';
import { normalizeProcessResult } from '../utils/processResult';

const interpretPipelinePath = '/api/pipeline/interpret';
const processPipelinePath = '/api/images/process-pipeline';

export async function interpretPipeline(
  payload: PipelineInterpretRequest,
): Promise<PipelineInterpretResponse> {
  return apiClient.request<PipelineInterpretResponse, PipelineInterpretRequest>({
    path: interpretPipelinePath,
    method: 'POST',
    body: payload,
  });
}

export async function processPipelineImage(
  payload: ProcessPipelineRequest,
): Promise<ProcessImageResponse> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('plan', JSON.stringify(payload.plan));

  const response = await apiClient.request<ProcessImageResponse, FormData>({
    path: processPipelinePath,
    method: 'POST',
    body: formData,
  });

  return normalizeProcessResult(response);
}
