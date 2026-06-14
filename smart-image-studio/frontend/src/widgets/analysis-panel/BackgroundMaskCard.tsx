import { EmptyState } from '@shared/ui/EmptyState';

export function BackgroundMaskCard({
  maskImageUrl,
  foregroundRatio,
}: {
  maskImageUrl?: string | null;
  foregroundRatio?: number;
}) {
  return (
    <article
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Background Mask</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        AI が前景として残した領域をマスク表示します。
      </p>

      <div
        className="mt-4 rounded-xl border p-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
      >
        {maskImageUrl ? (
          <img
            src={maskImageUrl}
            alt="背景除去マスク"
            className="w-full rounded-2xl border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)' }}
          />
        ) : (
          <EmptyState message="背景除去マスクはありません。" />
        )}

        <div
          className="mt-3 rounded-2xl border px-3 py-3"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)' }}
        >
          <div className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-label)' }}>Foreground Ratio</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {typeof foregroundRatio === 'number' ? `${(foregroundRatio * 100).toFixed(1)}%` : '-'}
          </div>
        </div>
      </div>
    </article>
  );
}
