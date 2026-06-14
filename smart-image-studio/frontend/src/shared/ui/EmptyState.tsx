import { Button } from './Button';

type Tone = 'default' | 'error';

export function EmptyState({
  message,
  variant = 'inline',
  tone = 'default',
  action,
}: {
  message: string;
  variant?: 'inline' | 'page';
  tone?: Tone;
  action?: { label: string; onClick: () => void };
}) {
  const isError = tone === 'error';

  if (variant === 'page') {
    return (
      <div
        className="rounded-xl border px-6 py-12 text-center text-sm"
        style={{
          background: isError ? 'var(--tone-danger-bg)' : 'var(--bg-panel)',
          borderColor: isError ? 'var(--tone-danger-border)' : 'var(--border-default)',
          color: isError ? 'var(--tone-danger-text)' : 'var(--text-muted)',
        }}
      >
        {message}
        {action && (
          <div className="mt-5">
            <Button variant="primary" onClick={action.onClick} className="px-5 py-2 font-semibold">
              {action.label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border px-4 py-5 text-sm ${isError ? '' : 'border-dashed'}`}
      style={{
        borderColor: isError ? 'var(--tone-danger-border)' : 'var(--border-subtle)',
        background: isError ? 'var(--tone-danger-bg)' : 'var(--bg-panel-raised)',
        color: isError ? 'var(--tone-danger-text)' : 'var(--text-muted)',
      }}
    >
      {message}
      {action && (
        <div className="mt-3">
          <Button variant="primary" size="xs" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
