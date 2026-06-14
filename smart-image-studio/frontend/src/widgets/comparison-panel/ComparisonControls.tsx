export type CompareMode = 'sync' | 'diff';

function ToolButton({
  label,
  onClick,
  active = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
      style={{
        background: active ? 'var(--accent-blue-bg-dim)' : 'var(--bg-input)',
        borderColor: active ? 'var(--accent-blue)' : 'var(--border-default)',
        color: active ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  );
}

export function ComparisonControls({
  mode,
  scale,
  message,
  appliedOperations,
  onSetMode,
  onZoomIn,
  onZoomOut,
  onResetTransform,
}: {
  mode: CompareMode;
  scale: number;
  message?: string;
  appliedOperations?: string[];
  onSetMode: (mode: CompareMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetTransform: () => void;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-default)' }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>
            Workspace
          </div>
          <h2
            className="font-sans mt-1.5 text-xl font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Before / After 比較
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            同期比較と差分表示を切り替えられます。
          </p>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap gap-2">
            <ToolButton label="同期比較" active={mode === 'sync'} onClick={() => onSetMode('sync')} />
            <ToolButton label="差分表示" active={mode === 'diff'} onClick={() => onSetMode('diff')} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ToolButton label="−" onClick={onZoomOut} />
            <div
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            >
              Zoom {(scale * 100).toFixed(0)}%
            </div>
            <ToolButton label="+" onClick={onZoomIn} />
            <ToolButton label="Reset" onClick={onResetTransform} />
          </div>
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
        style={{ background: 'var(--bg-shell)', borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>処理状況</div>
          <div className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {message ?? '未実行です。'}
          </div>
          {appliedOperations && appliedOperations.length > 0 ? (
            <div className="mt-2 text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              {appliedOperations.join(' / ')}
            </div>
          ) : null}
        </div>
        <div className="text-xs leading-6" style={{ color: 'var(--text-muted)' }}>
          ドラッグでパン、ホイールまたはボタンでズーム
        </div>
      </div>
    </div>
  );
}
