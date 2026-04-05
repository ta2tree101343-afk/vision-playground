import type { ImageProcessJob } from '../types/api';

interface JobStatusPanelProps {
  job: ImageProcessJob | null;
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
    second: '2-digit',
  }).format(date);
}

function statusLabel(status: ImageProcessJob['status']): string {
  switch (status) {
    case 'queued':
      return 'QUEUED';
    case 'running':
      return 'RUNNING';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
  }
}

function statusTone(status: ImageProcessJob['status']): string {
  switch (status) {
    case 'queued':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'running':
      return 'border-sky-300 bg-sky-50 text-sky-900';
    case 'completed':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'failed':
      return 'border-rose-300 bg-rose-50 text-rose-900';
  }
}

export function JobStatusPanel({ job }: JobStatusPanelProps) {
  if (!job) {
    return null;
  }

  return (
    <section className="space-y-3 p-0">
      <div className="flex items-center gap-4">
        <h2 className="text-[clamp(1.2rem,2vw,1.55rem)] font-black tracking-[-0.04em] text-[#1f1f1f]">
          実行中ステータス
        </h2>
        <div className="h-px flex-1 bg-[#e4dfd4]" />
      </div>

      <div className="rounded-[20px] border border-[#ddd5c8] bg-[#fcfbf8] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#8f887d]">
              Job {job.job_id.slice(0, 8)}
            </div>
            <div className="mt-1 text-lg font-semibold text-[#1f1f1f]">{job.filename}</div>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(job.status)}`}>
            {statusLabel(job.status)}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-[#5b554b]">{job.message}</span>
            <span className="font-semibold text-[#1f1f1f]">{job.progress}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-[#e7e1d6]">
            <div
              className="h-full rounded-full bg-[#19e39d] transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-[#5b554b] md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#8f887d]">作成</div>
            <div className="mt-1">{formatTimestamp(job.created_at)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#8f887d]">開始</div>
            <div className="mt-1">{formatTimestamp(job.started_at)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#8f887d]">完了</div>
            <div className="mt-1">{formatTimestamp(job.completed_at)}</div>
          </div>
        </div>

        {job.error_message ? (
          <div className="mt-4 rounded-[16px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {job.error_message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
