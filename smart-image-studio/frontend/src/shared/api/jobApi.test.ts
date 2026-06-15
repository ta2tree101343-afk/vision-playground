import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/api/__generated__/api.types', () => ({
  createProcessJobApiImagesJobsPost: vi.fn(),
  listProcessJobsApiImagesJobsGet: vi.fn(),
  getProcessJobApiImagesJobsJobIdGet: vi.fn(),
  OperationType: {
    grayscale: 'grayscale',
    blur: 'blur',
    sharpen: 'sharpen',
    denoise: 'denoise',
    edge_detection: 'edge_detection',
    brightness: 'brightness',
    contrast: 'contrast',
    background_removal: 'background_removal',
    ocr: 'ocr',
    object_detection: 'object_detection',
    caption_generation: 'caption_generation',
  },
}));

vi.mock('@shared/config/env', () => ({
  env: { apiBaseUrl: 'http://localhost:8000' },
}));

import {
  createProcessJobApiImagesJobsPost,
  listProcessJobsApiImagesJobsGet,
  getProcessJobApiImagesJobsJobIdGet,
} from '@shared/api/__generated__/api.types';
import type { ImageProcessJob } from '@shared/types/api';
import { createProcessJob, fetchProcessJob, fetchProcessJobs } from './jobApi';

const NOW = '2024-01-01T00:00:00+00:00';

function makeQueuedJob(jobId: string): ImageProcessJob {
  return {
    job_id: jobId,
    progress: 0,
    message: 'Queued',
    filename: 'test.jpg',
    created_at: NOW,
    applied_operations: [],
    status: 'queued',
    queue_position: 1,
    started_at: null,
    completed_at: null,
    result: null,
    error_message: null,
  };
}

// S is inferred as a literal type from the numeric argument, matching Orval's literal status codes.
function wrapped<T, S extends number>(data: T, status: S) {
  return { data, status, headers: new Headers() };
}

describe('createProcessJob', () => {
  beforeEach(() => {
    vi.mocked(createProcessJobApiImagesJobsPost).mockReset();
  });

  it('throws when operations array is empty', async () => {
    await expect(
      createProcessJob({ file: new File(['x'], 'x.jpg'), operations: [] }),
    ).rejects.toThrow('operation');
  });

  it('calls the API and returns a parsed job', async () => {
    const job = makeQueuedJob('job-1');
    vi.mocked(createProcessJobApiImagesJobsPost).mockResolvedValue(wrapped(job, 202));
    const result = await createProcessJob({
      file: new File(['x'], 'x.jpg'),
      operations: [{ operation: 'grayscale' }],
    });
    expect(result.job_id).toBe('job-1');
    expect(result.status).toBe('queued');
    expect(createProcessJobApiImagesJobsPost).toHaveBeenCalledOnce();
  });
});

describe('fetchProcessJob', () => {
  beforeEach(() => {
    vi.mocked(getProcessJobApiImagesJobsJobIdGet).mockReset();
  });

  it('fetches a job by ID and returns it parsed', async () => {
    const job = makeQueuedJob('job-2');
    vi.mocked(getProcessJobApiImagesJobsJobIdGet).mockResolvedValue(wrapped(job, 200));
    const result = await fetchProcessJob('job-2');
    expect(result.job_id).toBe('job-2');
    expect(vi.mocked(getProcessJobApiImagesJobsJobIdGet).mock.calls[0][0]).toBe('job-2');
  });

  it('rejects when API returns an unrecognized status', async () => {
    // Deliberately malformed data to trigger Zod schema rejection at runtime.
    vi.mocked(getProcessJobApiImagesJobsJobIdGet).mockResolvedValue(
      wrapped({ job_id: 'bad', status: 'unknown_status' }, 200) as never,
    );
    await expect(fetchProcessJob('bad')).rejects.toThrow();
  });
});

describe('fetchProcessJobs', () => {
  beforeEach(() => {
    vi.mocked(listProcessJobsApiImagesJobsGet).mockReset();
  });

  it('returns a list of parsed jobs', async () => {
    const jobs = [makeQueuedJob('job-a'), makeQueuedJob('job-b')];
    vi.mocked(listProcessJobsApiImagesJobsGet).mockResolvedValue(wrapped(jobs, 200));
    const result = await fetchProcessJobs();
    expect(result).toHaveLength(2);
    expect(result[0].job_id).toBe('job-a');
    expect(result[1].job_id).toBe('job-b');
  });

  it('returns an empty array when no jobs exist', async () => {
    vi.mocked(listProcessJobsApiImagesJobsGet).mockResolvedValue(wrapped([], 200));
    const result = await fetchProcessJobs();
    expect(result).toEqual([]);
  });
});
