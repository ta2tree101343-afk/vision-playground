import { useEffect, useRef, useState } from 'react';
import type { ImageProcessJob, OperationStep, PipelinePlan, ProcessImageResponse } from '../types/api';
import { createProcessJob, fetchProcessJob, fetchProcessJobs } from '../api/imageApi';
import { processPipelineImage } from '../api/pipelineApi';
import { saveJobNotice } from '../utils/jobNoticeStore';
import { saveLatestProcessResult } from '../utils/processResultStore';

interface UseJobTrackingOptions {
  onCompleted?: (result: ProcessImageResponse) => void;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

export function useJobTracking({ onCompleted }: UseJobTrackingOptions = {}) {
  const onCompletedRef = useRef(onCompleted);
  const handledJobsRef = useRef<Set<string>>(new Set());

  const [activeJob, setActiveJob] = useState<ImageProcessJob | null>(null);
  const [jobHistory, setJobHistory] = useState<ImageProcessJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setIsProcessing(active !== null);
      } catch {
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

    let cancelled = false;

    async function poll() {
      try {
        const [job, jobs] = await Promise.all([fetchProcessJob(jobId!), fetchProcessJobs()]);

        if (cancelled) return;

        setActiveJob(job);
        setJobHistory(jobs);
        setIsProcessing(job.status === 'queued' || job.status === 'running');

        if (handledJobsRef.current.has(job.job_id)) return;

        if (job.status === 'completed') {
          handledJobsRef.current.add(job.job_id);

          if (!job.result) {
            setIsProcessing(false);
            setErrorMessage('ジョブは完了しましたが、結果を取得できませんでした。');
            return;
          }

          saveLatestProcessResult(job.result);
          saveJobNotice({ tone: 'success', message: `ジョブ ${job.job_id.slice(0, 8)} が完了しました。` });
          setIsProcessing(false);
          setErrorMessage(null);
          onCompletedRef.current?.(job.result);
        }

        if (job.status === 'failed') {
          handledJobsRef.current.add(job.job_id);
          setIsProcessing(false);
          setErrorMessage(job.error_message ?? '画像処理ジョブが失敗しました。');
        }
      } catch (error) {
        if (!cancelled) {
          setIsProcessing(false);
          setErrorMessage(toErrorMessage(error, 'ジョブ状態の取得に失敗しました。'));
        }
      }
    }

    void poll();
    const id = window.setInterval(() => { void poll(); }, 1500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [activeJob?.job_id, activeJob?.status]);

  async function submitJob(file: File, operations: OperationStep[]) {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const job = await createProcessJob({ file, operations });
      setActiveJob(job);
      setJobHistory((current) => [job, ...current.filter((j) => j.job_id !== job.job_id)]);
    } catch (error) {
      setIsProcessing(false);
      setErrorMessage(toErrorMessage(error, 'ジョブの作成に失敗しました。'));
    }
  }

  async function submitPipelinePlan(file: File, plan: PipelinePlan) {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await processPipelineImage({ file, plan });
      saveLatestProcessResult(result);
      setIsProcessing(false);
      setErrorMessage(null);
      onCompletedRef.current?.(result);
    } catch (error) {
      setIsProcessing(false);
      setErrorMessage(toErrorMessage(error, 'PipelinePlan の実行に失敗しました。'));
    }
  }

  function openJobResult(job: ImageProcessJob) {
    if (!job.result) {
      setErrorMessage('このジョブには表示できる結果がありません。');
      return;
    }
    saveLatestProcessResult(job.result);
    onCompletedRef.current?.(job.result);
  }

  return {
    activeJob,
    jobHistory,
    isProcessing,
    errorMessage,
    submitJob,
    submitPipelinePlan,
    openJobResult,
  };
}
