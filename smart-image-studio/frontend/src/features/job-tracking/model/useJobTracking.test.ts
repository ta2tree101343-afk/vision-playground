import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

vi.mock('@shared/api/jobApi', () => ({
  createProcessJob: vi.fn(),
  fetchProcessJob: vi.fn(),
  fetchProcessJobs: vi.fn(),
}));

vi.mock('@entities/job/lib/processResultStore', () => ({
  saveLatestProcessResult: vi.fn(),
}));

vi.mock('@shared/config/env', () => ({
  env: { apiBaseUrl: 'http://localhost:8000' },
}));

import { createProcessJob, fetchProcessJob, fetchProcessJobs } from '@shared/api/jobApi';
import { saveLatestProcessResult } from '@entities/job/lib/processResultStore';
import type { ImageProcessJob, ProcessImageResponse } from '@shared/types/api';
import { useJobTracking } from './useJobTracking';

const NOW = '2024-01-01T00:00:00+00:00';

const RESULT: ProcessImageResponse = {
  message: 'Success',
  original_image_url: 'http://localhost:8000/uploads/originals/test.jpg',
  processed_image_url: 'http://localhost:8000/uploads/processed/test.jpg',
  processed_filename: 'test.jpg',
  applied_operations: [{ operation: 'grayscale' }],
};

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

function makeCompletedJob(jobId: string): ImageProcessJob {
  return {
    job_id: jobId,
    progress: 100,
    message: 'Done',
    filename: 'test.jpg',
    created_at: NOW,
    applied_operations: [],
    status: 'completed',
    started_at: NOW,
    completed_at: NOW,
    result: RESULT,
    queue_position: null,
    error_message: null,
  };
}

function makeFailedJob(jobId: string): ImageProcessJob {
  return {
    job_id: jobId,
    progress: 0,
    message: 'Failed',
    filename: 'test.jpg',
    created_at: NOW,
    applied_operations: [],
    status: 'failed',
    started_at: NOW,
    completed_at: NOW,
    error_message: '処理に失敗しました',
    queue_position: null,
    result: null,
  };
}

describe('useJobTracking', () => {
  beforeEach(() => {
    vi.mocked(fetchProcessJobs).mockResolvedValue([]);
    // Hang on poll by default so tests that don't care about polling don't race.
    vi.mocked(fetchProcessJob).mockReturnValue(new Promise(() => {}));
    vi.mocked(createProcessJob).mockResolvedValue(makeQueuedJob('new-job'));
    vi.mocked(saveLatestProcessResult).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('starts with empty history and no active job', async () => {
    const { result } = renderHook(() => useJobTracking());
    await waitFor(() => {
      expect(result.current.jobHistory).toEqual([]);
    });
    expect(result.current.activeJob).toBeNull();
    expect(result.current.isProcessing).toBe(false);
  });

  it('sets activeJob when history contains a queued job', async () => {
    const queued = makeQueuedJob('job-1');
    vi.mocked(fetchProcessJobs).mockResolvedValue([queued]);

    const { result } = renderHook(() => useJobTracking());

    await waitFor(() => {
      expect(result.current.activeJob?.job_id).toBe('job-1');
    });
    expect(result.current.isProcessing).toBe(true);
  });

  it('saves result and calls onCompleted when job completes', async () => {
    const queued = makeQueuedJob('job-1');
    const completed = makeCompletedJob('job-1');
    const onCompleted = vi.fn();

    vi.mocked(fetchProcessJobs)
      .mockResolvedValueOnce([queued])
      .mockResolvedValue([completed]);
    vi.mocked(fetchProcessJob).mockResolvedValue(completed);

    renderHook(() => useJobTracking({ onCompleted }));

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledWith(RESULT);
    });
    expect(saveLatestProcessResult).toHaveBeenCalledWith(RESULT);
  });

  it('sets error message when job fails', async () => {
    const queued = makeQueuedJob('job-1');
    const failed = makeFailedJob('job-1');

    vi.mocked(fetchProcessJobs)
      .mockResolvedValueOnce([queued])
      .mockResolvedValue([failed]);
    vi.mocked(fetchProcessJob).mockResolvedValue(failed);

    const { result } = renderHook(() => useJobTracking());

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('処理に失敗しました');
    });
    expect(result.current.activeJob).toBeNull();
  });

  it('submitJob creates a job and sets it as active', async () => {
    const newJob = makeQueuedJob('submitted-job');
    vi.mocked(createProcessJob).mockResolvedValue(newJob);

    const { result } = renderHook(() => useJobTracking());

    // Wait for initial load to settle
    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    await act(async () => {
      await result.current.submitJob(new File(['x'], 'x.jpg'), [{ operation: 'grayscale' }]);
    });

    expect(result.current.activeJob?.job_id).toBe('submitted-job');
    expect(result.current.isProcessing).toBe(true);
  });

  it('openJobResult saves result and calls onCompleted for completed job', () => {
    const completed = makeCompletedJob('job-x');
    const onCompleted = vi.fn();

    const { result } = renderHook(() => useJobTracking({ onCompleted }));

    act(() => {
      result.current.openJobResult(completed);
    });

    expect(saveLatestProcessResult).toHaveBeenCalledWith(RESULT);
    expect(onCompleted).toHaveBeenCalledWith(RESULT);
  });

  it('openJobResult sets error for non-completed job', () => {
    const queued = makeQueuedJob('job-y');
    const { result } = renderHook(() => useJobTracking());

    act(() => {
      result.current.openJobResult(queued);
    });

    expect(result.current.errorMessage).toBeTruthy();
    expect(saveLatestProcessResult).not.toHaveBeenCalled();
  });

  it('sets error and does not call onCompleted when saveLatestProcessResult returns false during polling', async () => {
    const queued = makeQueuedJob('job-1');
    const completed = makeCompletedJob('job-1');
    const onCompleted = vi.fn();

    vi.mocked(fetchProcessJobs).mockResolvedValueOnce([queued]).mockResolvedValue([completed]);
    vi.mocked(fetchProcessJob).mockResolvedValue(completed);
    vi.mocked(saveLatestProcessResult).mockReturnValue(false);

    const { result } = renderHook(() => useJobTracking({ onCompleted }));

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('処理結果の保存に失敗しました。ストレージへの書き込みができませんでした。');
    });
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('clears isProcessing and sets errorMessage when submitJob rejects', async () => {
    vi.mocked(createProcessJob).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useJobTracking());
    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    await act(async () => {
      await result.current.submitJob(new File(['x'], 'x.jpg'), [{ operation: 'grayscale' }]);
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('sets errorMessage when initial fetchProcessJobs rejects', async () => {
    vi.mocked(fetchProcessJobs).mockRejectedValue(new Error('Server down'));

    const { result } = renderHook(() => useJobTracking());

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('単体処理のジョブ履歴取得に失敗しました。');
    });
  });

  it('sets error and does not call onCompleted when openJobResult storage write fails', () => {
    const completed = makeCompletedJob('job-x');
    const onCompleted = vi.fn();
    vi.mocked(saveLatestProcessResult).mockReturnValue(false);

    const { result } = renderHook(() => useJobTracking({ onCompleted }));

    act(() => {
      result.current.openJobResult(completed);
    });

    expect(result.current.errorMessage).toBe('処理結果の保存に失敗しました。ストレージへの書き込みができませんでした。');
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('sets error when onCompleted callback throws during polling', async () => {
    const queued = makeQueuedJob('job-1');
    const completed = makeCompletedJob('job-1');
    const onCompleted = vi.fn().mockImplementation(() => {
      throw new Error('Navigation failed');
    });

    vi.mocked(fetchProcessJobs).mockResolvedValueOnce([queued]).mockResolvedValue([completed]);
    vi.mocked(fetchProcessJob).mockResolvedValue(completed);

    const { result } = renderHook(() => useJobTracking({ onCompleted }));

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('結果ページへの遷移に失敗しました。');
    });
  });
});
