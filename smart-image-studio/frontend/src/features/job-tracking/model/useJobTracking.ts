import { useEffect, useRef, useState } from 'react';
import type { ImageProcessJob, OperationStep, ProcessImageResponse } from '@shared/types/api';
import { createProcessJob, fetchProcessJob, fetchProcessJobs } from '@shared/api/jobApi';

import { saveLatestProcessResult } from '@entities/job/lib/processResultStore';
import { toErrorMessage } from '@shared/lib/error';

interface UseJobTrackingOptions {
  onCompleted?: (result: ProcessImageResponse) => void;
}

export function useJobTracking({ onCompleted }: UseJobTrackingOptions = {}) {
  const onCompletedRef = useRef(onCompleted);
  const handledJobsRef = useRef<Set<string>>(new Set());

  const [activeJob, setActiveJob] = useState<ImageProcessJob | null>(null);
  const [jobHistory, setJobHistory] = useState<ImageProcessJob[]>([]);
  // Covers the window between submit button click and job creation API returning.
  // After job creation, isProcessing is derived from activeJob.status.
  const [isPendingSubmit, setIsPendingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isProcessing =
    isPendingSubmit ||
    activeJob?.status === 'queued' ||
    activeJob?.status === 'running';

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const jobs = await fetchProcessJobs();
        if (cancelled) return;
        setJobHistory(jobs);
        const active = jobs.find((j) => j.status === 'queued' || j.status === 'running') ?? null;
        setActiveJob(active);
      } catch (error) {
        console.error('[useJobTracking] Failed to load job history:', error);
        if (!cancelled) setErrorMessage('単体処理のジョブ履歴取得に失敗しました。');
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const jobId = activeJob?.job_id;
    const jobStatus = activeJob?.status;

    if (!jobId || !jobStatus || !['queued', 'running'].includes(jobStatus)) return;

    const activeJobId: string = jobId;
    let cancelled = false;

    async function refreshJobHistory() {
      const jobs = await fetchProcessJobs();
      if (cancelled) return;
      setJobHistory(jobs);
      const nextActive = jobs.find((j) => j.status === 'queued' || j.status === 'running') ?? null;
      setActiveJob(nextActive);
    }

    async function poll() {
      try {
        const job = await fetchProcessJob(activeJobId);
        if (cancelled) return;

        const isActive = job.status === 'queued' || job.status === 'running';
        setActiveJob(isActive ? job : null);
        setJobHistory((current) => [
          job,
          ...current.filter((j) => j.job_id !== job.job_id),
        ]);
        if (isActive) setErrorMessage(null);

        if (handledJobsRef.current.has(job.job_id)) return;

        if (job.status === 'completed') {
          handledJobsRef.current.add(job.job_id);
          if (!job.result) {
            setErrorMessage('ジョブは完了しましたが、結果を取得できませんでした。');
            return;
          }
          if (!saveLatestProcessResult(job.result)) {
            setErrorMessage('処理結果の保存に失敗しました。ストレージへの書き込みができませんでした。');
            return;
          }
          setErrorMessage(null);
          void refreshJobHistory().catch((error) => {
            console.error('[useJobTracking] refreshJobHistory failed:', error);
            if (!cancelled) setErrorMessage(toErrorMessage(error, '履歴の更新に失敗しました。'));
          });
          try {
            onCompletedRef.current?.(job.result);
          } catch (callbackError) {
            console.error('[useJobTracking] onCompleted callback threw:', callbackError);
            if (!cancelled) setErrorMessage('結果ページへの遷移に失敗しました。');
          }
        }

        if (job.status === 'failed') {
          handledJobsRef.current.add(job.job_id);
          setErrorMessage(job.error_message ?? '画像処理ジョブが失敗しました。');
          void refreshJobHistory().catch((error) => {
            console.error('[useJobTracking] refreshJobHistory failed:', error);
          });
        }
      } catch (error) {
        console.error('[useJobTracking] Polling failed for job:', jobId, error);
        if (!cancelled) {
          // Do not clear isProcessing here — the job is still running on the server.
          // isProcessing clears automatically once polling observes a terminal activeJob status.
          setErrorMessage(toErrorMessage(error, 'ジョブ状態の取得に失敗しました。'));
        }
      }
    }

    let timerId: number;
    async function scheduledPoll() {
      await poll();
      if (cancelled) return;
      timerId = window.setTimeout(() => { void scheduledPoll(); }, 1500);
    }
    void scheduledPoll();
    return () => { cancelled = true; window.clearTimeout(timerId); };
  }, [activeJob?.job_id, activeJob?.status]);

  async function submitJob(file: File, operations: OperationStep[]) {
    if (isProcessing) return;

    setIsPendingSubmit(true);
    setErrorMessage(null);

    try {
      const job = await createProcessJob({ file, operations });
      setActiveJob(job);
      setIsPendingSubmit(false);
      setJobHistory((current) => [job, ...current.filter((j) => j.job_id !== job.job_id)]);
    } catch (error) {
      setIsPendingSubmit(false);
      setErrorMessage(toErrorMessage(error, 'ジョブの作成に失敗しました。'));
    }
  }

  function openJobResult(job: ImageProcessJob) {
    if (job.status !== 'completed' || !job.result) {
      setErrorMessage('このジョブには表示できる結果がありません。');
      return;
    }
    if (!saveLatestProcessResult(job.result)) {
      setErrorMessage('処理結果の保存に失敗しました。ストレージへの書き込みができませんでした。');
      return;
    }
    try {
      onCompletedRef.current?.(job.result);
    } catch (callbackError) {
      console.error('[useJobTracking] openJobResult callback threw:', callbackError);
      setErrorMessage('結果ページへの遷移に失敗しました。');
    }
  }

  return {
    activeJob,
    jobHistory,
    isProcessing,
    errorMessage,
    setErrorMessage,
    submitJob,
    openJobResult,
  };
}
