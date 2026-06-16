import { EmptyState } from '@shared/ui/EmptyState';


export function CaptionCandidatesCard({
  candidates,
  errorMessage,
  imageUrl,
}: {
  candidates: Array<{ text: string }>;
  errorMessage?: string | null;
  imageUrl?: string;
}) {
  const candidateList = candidates.length > 0 ? (
    candidates.map((candidate, index) => (
      <div
        key={`${candidate.text}-${index}`}
        className="rounded-2xl border p-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)' }}
      >
        <div className="text-sm leading-6" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{candidate.text}</div>
      </div>
    ))
  ) : errorMessage ? (
    <EmptyState tone="error" message={errorMessage} />
  ) : (
    <EmptyState message="キャプション候補はまだありません。" />
  );

  return (
    <article
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Caption Candidates</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        AI分析から組み立てた説明候補です。
      </p>

      {imageUrl ? (
        <div
          className="mt-4 flex items-start gap-3 rounded-xl border p-3"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
        >
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}>
            <img src={imageUrl} alt="source" className="block w-full" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">{candidateList}</div>
        </div>
      ) : (
        <div
          className="mt-4 space-y-3 rounded-xl border p-3"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
        >
          {candidateList}
        </div>
      )}
    </article>
  );
}
