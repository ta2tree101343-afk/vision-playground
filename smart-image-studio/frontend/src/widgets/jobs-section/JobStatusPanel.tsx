import type { ImageProcessJob } from '@shared/types/api';
import { formatTimestamp, statusStyle } from '@features/job-tracking';

interface JobStatusPanelProps {
  job: ImageProcessJob | null;
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

function progressColor(status: ImageProcessJob['status']): string {
  switch (status) {
    case 'queued':
      return 'var(--tone-warning-text)';
    case 'running':
      return 'var(--accent-blue-bright)';
    case 'completed':
      return 'var(--accent-blue-bright)';
    case 'failed':
      return 'var(--tone-danger-text)';
  }
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function JobStatusPanel({ job }: JobStatusPanelProps) {
  if (!job) return null;

  const progress = clampProgress(job.progress);

  return (
    <section className="space-y-3 p-0">
      <div className="flex items-center gap-4">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          実行中ステータス
        </h2>
        <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
      </div>

      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--bg-panel-raised)', borderColor: 'var(--border-default)' }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="font-mono-val text-xs uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Job {job.job_id.slice(0, 8)}
            </div>
            <div
              className="mt-1 break-all text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {job.filename}
            </div>
          </div>
          <div
            className="w-fit rounded-full border px-3 py-1 text-xs font-semibold"
            style={statusStyle(job.status)}
          >
            {statusLabel(job.status)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>{job.message}</span>
            <span className="font-mono-val font-semibold" style={{ color: 'var(--text-primary)' }}>
              {progress}%
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            style={{ background: 'var(--border-strong)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: progressColor(job.status),
              }}
            />
          </div>
        </div>

        {/* Timestamps */}
        <div
          className="mt-4 grid gap-3 text-sm md:grid-cols-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          {[
            { label: '作成', value: job.created_at },
            { label: '開始', value: job.started_at },
            { label: '完了', value: job.completed_at },
          ].map(({ label, value }) => (
            <div key={label}>
              <div
                className="text-xs uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                {label}
              </div>
              <div className="font-mono-val mt-1 text-xs">
                {formatTimestamp(value, { second: '2-digit' })}
              </div>
            </div>
          ))}
        </div>

        {job.status === 'failed' && job.error_message && (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--tone-danger-border)',
              background: 'var(--tone-danger-bg)',
              color: 'var(--tone-danger-text)',
            }}
          >
            {job.error_message}
          </div>
        )}
      </div>
    </section>
  );
}
