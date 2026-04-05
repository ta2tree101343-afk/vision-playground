import { operationLabels } from '../config/imageOperations';
import type { ImageProcessJob } from '../types/api';

interface JobHistoryPanelProps {
  jobs: ImageProcessJob[];
  onOpenResult: (job: ImageProcessJob) => void;
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusTone(status: ImageProcessJob['status']): string {
  switch (status) {
    case 'queued':
      return 'bg-amber-50 text-amber-900 border-amber-300';
    case 'running':
      return 'bg-sky-50 text-sky-900 border-sky-300';
    case 'completed':
      return 'bg-emerald-50 text-emerald-900 border-emerald-300';
    case 'failed':
      return 'bg-rose-50 text-rose-900 border-rose-300';
  }
}

export function JobHistoryPanel({ jobs, onOpenResult }: JobHistoryPanelProps) {
  const finishedJobs = jobs.filter((job) => job.status === 'completed' || job.status === 'failed');

  if (finishedJobs.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 p-0">
      <div className="flex items-center gap-4">
        <h2 className="text-[clamp(1.2rem,2vw,1.55rem)] font-black tracking-[-0.04em] text-[#1f1f1f]">
          ジョブ履歴
        </h2>
        <div className="h-px flex-1 bg-[#e4dfd4]" />
      </div>

      <div>
        <div className="text-sm font-semibold text-[#1f1f1f]">処理履歴</div>
        <div className="mt-3 space-y-3">
          {finishedJobs.slice(0, 8).map((job) => (
            <div
              key={job.job_id}
              className="rounded-[18px] border border-[#ddd5c8] bg-[#fcfbf8] px-4 py-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-[#1f1f1f]">{job.filename}</div>
                    <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${statusTone(job.status)}`}>
                      {job.status}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-[#8f887d]">
                    {formatTimestamp(job.completed_at ?? job.created_at)}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[#5b554b]">
                    {job.applied_operations.map((item) => operationLabels[item.operation]).join(' / ')}
                  </div>
                  {job.error_message ? (
                    <div className="mt-2 text-sm text-rose-200">{job.error_message}</div>
                  ) : null}
                </div>
                {job.status === 'completed' && job.result ? (
                  <button
                    type="button"
                    onClick={() => onOpenResult(job)}
                    className="rounded-full bg-[#1f6a50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255f4c]"
                  >
                    結果を見る
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
