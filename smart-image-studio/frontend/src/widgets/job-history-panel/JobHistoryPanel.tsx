import type { OperationType, ImageProcessJob } from '@shared/types/api';
import { formatTimestamp, statusStyle } from '@features/job-tracking/lib/jobFormatters';
import { operationLabelsJa, AI_OPS } from '@features/operation-select/config/imageOperations';

function OperationChip({ operation }: { operation: OperationType }) {
  const isAI = AI_OPS.has(operation);
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        background: isAI ? 'rgba(147,51,234,0.12)' : 'rgba(255,255,255,0.06)',
        color: isAI ? '#c084fc' : 'var(--text-secondary)',
        border: `1px solid ${isAI ? 'rgba(147,51,234,0.3)' : 'var(--border-default)'}`,
      }}
    >
      {operationLabelsJa[operation]}
    </span>
  );
}

function processingTime(job: ImageProcessJob): string | null {
  if (job.status !== 'completed' && job.status !== 'failed') return null;
  const start = job.started_at ? new Date(job.started_at).getTime() : null;
  const end = job.completed_at ? new Date(job.completed_at).getTime() : null;
  if (start === null || end === null) return null;
  return `${((end - start) / 1000).toFixed(1)}秒`;
}

function applyFilters(
  jobs: ImageProcessJob[],
  searchQuery: string,
  filterDate: string,
  selectedOperations: OperationType[],
): ImageProcessJob[] {
  let filtered = jobs;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((j) => j.filename.toLowerCase().includes(q));
  }
  if (filterDate) {
    const dateStart = new Date(filterDate);
    const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
    filtered = filtered.filter((j) => {
      const t = new Date(j.created_at).getTime();
      return t >= dateStart.getTime() && t < dateEnd.getTime();
    });
  }
  if (selectedOperations.length > 0) {
    filtered = filtered.filter((j) =>
      j.applied_operations.some((op) => selectedOperations.includes(op.operation)),
    );
  }
  return filtered;
}

interface JobHistoryPanelProps {
  jobs: ImageProcessJob[];
  onOpenResult: (job: ImageProcessJob) => void;
  searchQuery: string;
  filterDate: string;
  selectedOperations: OperationType[];
}

export function JobHistoryPanel({
  jobs,
  onOpenResult,
  searchQuery,
  filterDate,
  selectedOperations,
}: JobHistoryPanelProps) {
  const finishedJobs = jobs.filter((job) => job.status === 'completed' || job.status === 'failed');

  if (finishedJobs.length === 0) return null;

  const visible = applyFilters(finishedJobs, searchQuery, filterDate, selectedOperations);

  return (
    <section className="space-y-2 p-0">
      {visible.length === 0 ? (
        <div
          className="rounded-xl border px-4 py-6 text-center text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
        >
          該当する履歴がありません
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((job) => {
            const elapsed = processingTime(job);
            return (
              <div
                key={job.job_id}
                className="rounded-xl border px-4 py-3"
                style={{ background: 'var(--bg-panel-raised)', borderColor: 'var(--border-default)' }}
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="break-all text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {job.filename}
                      </div>
                      <div
                        className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase"
                        style={statusStyle(job.status)}
                      >
                        {job.status}
                      </div>
                      {elapsed && (
                        <div className="font-mono-val text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {elapsed}
                        </div>
                      )}
                    </div>

                    <div className="font-mono-val mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatTimestamp(job.completed_at ?? job.created_at)}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {job.applied_operations.map((item, index) => (
                        <OperationChip key={`${item.operation}-${index}`} operation={item.operation} />
                      ))}
                    </div>

                    {job.status === 'failed' && job.error_message && (
                      <div className="mt-2 text-xs" style={{ color: '#fca5a5' }}>
                        {job.error_message}
                      </div>
                    )}
                  </div>

                  {job.status === 'completed' && job.result && (
                    <button
                      type="button"
                      onClick={() => onOpenResult(job)}
                      className="flex-shrink-0 self-start rounded-full px-4 py-1.5 text-sm font-semibold transition-all hover-bg-job-result"
                      style={{
                        background: 'rgba(42,91,200,0.12)',
                        border: '1px solid rgba(42,91,200,0.3)',
                        color: 'var(--accent-blue-bright)',
                      }}
                    >
                      結果を見る
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
