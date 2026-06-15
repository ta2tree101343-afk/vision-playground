import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ImageProcessJob, OperationStep } from '@shared/types/api';

type CommonOverride = { job_id?: string; filename?: string; applied_operations?: OperationStep[] };
import { JobHistoryPanel } from './JobHistoryPanel';

afterEach(cleanup);

const NOW = '2024-06-01T10:00:00+09:00';
const START = '2024-06-01T10:00:00+09:00';
const END = '2024-06-01T10:00:02+09:00'; // 2.0秒後

function makeCompleted(overrides: CommonOverride = {}): ImageProcessJob {
  return {
    job_id: 'job-c1',
    progress: 100,
    message: 'Done',
    filename: 'photo.jpg',
    created_at: NOW,
    applied_operations: [{ operation: 'grayscale' }],
    status: 'completed',
    started_at: START,
    completed_at: END,
    result: {
      message: 'OK',
      original_image_url: 'http://localhost:8000/uploads/originals/photo.jpg',
      processed_image_url: 'http://localhost:8000/uploads/processed/photo.jpg',
      processed_filename: 'photo.jpg',
      applied_operations: [{ operation: 'grayscale' }],
    },
    queue_position: null,
    error_message: null,
    ...overrides,
  };
}

function makeFailed(overrides: CommonOverride = {}): ImageProcessJob {
  return {
    job_id: 'job-f1',
    progress: 0,
    message: 'Error',
    filename: 'broken.jpg',
    created_at: NOW,
    applied_operations: [{ operation: 'blur' }],
    status: 'failed',
    started_at: START,
    completed_at: END,
    error_message: '処理中にエラーが発生しました',
    queue_position: null,
    result: null,
    ...overrides,
  };
}

function makeQueued(): ImageProcessJob {
  return {
    job_id: 'job-q1',
    progress: 0,
    message: 'Queued',
    filename: 'pending.jpg',
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

const noop = vi.fn();

describe('JobHistoryPanel', () => {
  it('renders nothing when there are no finished jobs', () => {
    const { container } = render(
      <JobHistoryPanel
        jobs={[makeQueued()]}
        onOpenResult={noop}
        searchQuery=""
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders completed job with filename and status chip', () => {
    render(
      <JobHistoryPanel
        jobs={[makeCompleted()]}
        onOpenResult={noop}
        searchQuery=""
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('shows "結果を見る" button for completed jobs with result', () => {
    render(
      <JobHistoryPanel
        jobs={[makeCompleted()]}
        onOpenResult={noop}
        searchQuery=""
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(screen.getByRole('button', { name: '結果を見る' })).toBeInTheDocument();
  });

  it('calls onOpenResult when "結果を見る" is clicked', () => {
    const onOpenResult = vi.fn();
    const job = makeCompleted();
    render(
      <JobHistoryPanel
        jobs={[job]}
        onOpenResult={onOpenResult}
        searchQuery=""
        filterDate=""
        selectedOperations={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '結果を見る' }));
    expect(onOpenResult).toHaveBeenCalledWith(job);
  });

  it('renders failed job with error message and no result button', () => {
    render(
      <JobHistoryPanel
        jobs={[makeFailed()]}
        onOpenResult={noop}
        searchQuery=""
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('処理中にエラーが発生しました')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '結果を見る' })).toBeNull();
  });

  it('shows processing time for completed job with start/end timestamps', () => {
    render(
      <JobHistoryPanel
        jobs={[makeCompleted()]}
        onOpenResult={noop}
        searchQuery=""
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('2.0秒')).toBeInTheDocument();
  });

  it('renders operation chips from applied_operations', () => {
    render(
      <JobHistoryPanel
        jobs={[makeCompleted({ applied_operations: [{ operation: 'grayscale' }, { operation: 'blur' }] })]}
        onOpenResult={noop}
        searchQuery=""
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('モノクロ')).toBeInTheDocument();
    expect(screen.getByText('ぼかし')).toBeInTheDocument();
  });

  it('shows "該当する履歴がありません" when filename filter excludes all jobs', () => {
    render(
      <JobHistoryPanel
        jobs={[makeCompleted({ filename: 'photo.jpg' })]}
        onOpenResult={noop}
        searchQuery="nomatch"
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('該当する履歴がありません')).toBeInTheDocument();
  });

  it('shows matching job when filename filter matches', () => {
    render(
      <JobHistoryPanel
        jobs={[makeCompleted({ filename: 'photo.jpg' }), makeCompleted({ job_id: 'job-c2', filename: 'other.jpg' })]}
        onOpenResult={noop}
        searchQuery="photo"
        filterDate=""
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.queryByText('other.jpg')).toBeNull();
  });

  it('filters by operation type', () => {
    const graysaleJob = makeCompleted({ filename: 'gs.jpg', applied_operations: [{ operation: 'grayscale' }] });
    const blurJob = makeCompleted({ job_id: 'job-c2', filename: 'bl.jpg', applied_operations: [{ operation: 'blur' }] });
    render(
      <JobHistoryPanel
        jobs={[graysaleJob, blurJob]}
        onOpenResult={noop}
        searchQuery=""
        filterDate=""
        selectedOperations={['grayscale']}
      />,
    );
    expect(screen.getByText('gs.jpg')).toBeInTheDocument();
    expect(screen.queryByText('bl.jpg')).toBeNull();
  });

  it('shows job when filterDate matches created_at date', () => {
    // NOW = '2024-06-01T10:00:00+09:00' = 2024-06-01T01:00:00Z, falls within 2024-06-01 local range
    render(
      <JobHistoryPanel
        jobs={[makeCompleted({ filename: 'photo.jpg' })]}
        onOpenResult={noop}
        searchQuery=""
        filterDate="2024-06-01"
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  it('shows "該当する履歴がありません" when filterDate does not match any job', () => {
    render(
      <JobHistoryPanel
        jobs={[makeCompleted({ filename: 'photo.jpg' })]}
        onOpenResult={noop}
        searchQuery=""
        filterDate="2024-06-02"
        selectedOperations={[]}
      />,
    );
    expect(screen.getByText('該当する履歴がありません')).toBeInTheDocument();
  });
});
