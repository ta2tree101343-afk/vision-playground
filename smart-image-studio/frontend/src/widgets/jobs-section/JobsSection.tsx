import { useState } from 'react';
import { SectionShell } from '@shared/ui/SectionShell';
import { JobHistoryPanel } from '@widgets/job-history-panel/JobHistoryPanel';
import { JobStatusPanel } from '@widgets/job-status-panel/JobStatusPanel';
import type { ImageProcessJob, OperationType } from '@shared/types/api';
import { JobsFilterButton } from './JobsFilterButton';

export function JobsSection({
  activeJob,
  jobHistory,
  onOpenResult,
}: {
  activeJob: ImageProcessJob | null;
  jobHistory: ImageProcessJob[];
  onOpenResult: (job: ImageProcessJob) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedOperations, setSelectedOperations] = useState<OperationType[]>([]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayJobs = jobHistory.filter((j) => new Date(j.created_at) >= todayStart);
  const todayCompleted = todayJobs.filter((j) => j.status === 'completed');
  const avgMs =
    todayCompleted.length > 0
      ? todayCompleted.reduce((sum, j) => {
          const start = j.started_at ? new Date(j.started_at).getTime() : null;
          const end = j.completed_at ? new Date(j.completed_at).getTime() : null;
          return start !== null && end !== null ? sum + (end - start) : sum;
        }, 0) / todayCompleted.length
      : null;
  const avgTimeStr = avgMs !== null ? `${(avgMs / 1000).toFixed(1)}秒` : '-';

  function toggleOperation(op: OperationType) {
    setSelectedOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  }

  function clearFilters() {
    setSearchQuery('');
    setFilterDate('');
    setSelectedOperations([]);
  }

  const filterButton = (
    <JobsFilterButton
      searchQuery={searchQuery}
      filterDate={filterDate}
      selectedOperations={selectedOperations}
      onSearchChange={setSearchQuery}
      onDateChange={setFilterDate}
      onToggleOperation={toggleOperation}
      onClearFilters={clearFilters}
    />
  );

  return (
    <SectionShell title="処理履歴" headerRight={filterButton}>
      <div className="space-y-4">
        {todayJobs.length > 0 && (
          <div
            className="grid grid-cols-3 gap-3 rounded-xl border px-4 py-3"
            style={{ background: 'var(--bg-panel-raised)', borderColor: 'var(--border-default)' }}
          >
            {[
              { label: '本日の処理数', value: `${todayJobs.length}` },
              { label: '完了数', value: `${todayCompleted.length}` },
              { label: '平均処理時間', value: avgTimeStr },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </div>
                <div className="mt-1 font-mono-val text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
        <JobStatusPanel job={activeJob} />
        <JobHistoryPanel
          jobs={jobHistory}
          onOpenResult={onOpenResult}
          searchQuery={searchQuery}
          filterDate={filterDate}
          selectedOperations={selectedOperations}
        />
      </div>
    </SectionShell>
  );
}
