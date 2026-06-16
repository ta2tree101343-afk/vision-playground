import { Component, type ErrorInfo, type ReactNode } from 'react';
import { toErrorMessage } from '@shared/lib/error';

interface Props {
  children: ReactNode;
  /** Section-level fallback. When provided, renders this instead of the full-page error UI. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: unknown;
}

function reloadPage(): void {
  if (typeof window === 'undefined') return;
  window.location.reload();
}

/**
 * Hook for integrating with external error tracking services (e.g. Sentry).
 * Replace the console.error call with reportError(error, info) once tracking is set up.
 */
function reportError(error: Error, info: ErrorInfo): void {
  console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  // e.g. Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
          style={{ background: 'var(--bg-shell)', color: 'var(--text-primary)' }}
        >
          <div
            role="alert"
            className="rounded-2xl border p-8"
            style={{
              background: 'var(--bg-panel)',
              borderColor: 'var(--tone-danger-border-bright)',
              maxWidth: '480px',
            }}
          >
            <div
              className="text-lg font-semibold"
              style={{ color: 'var(--tone-danger-text-bright)' }}
            >
              予期しないエラーが発生しました
            </div>
            <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              ページを再読み込みしてください。問題が続く場合はサポートにお問い合わせください。
            </div>
            {import.meta.env.DEV && this.state.error !== null && this.state.error !== undefined && (
              <div
                className="mt-4 rounded-lg p-3 text-left text-xs font-mono"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  color: 'var(--tone-danger-text-bright)',
                  overflowX: 'auto',
                }}
              >
                {toErrorMessage(this.state.error)}
              </div>
            )}
            <button
              type="button"
              onClick={reloadPage}
              className="mt-6 rounded-full px-5 py-2 text-sm font-semibold"
              style={{ background: 'var(--accent-blue)', color: 'white' }}
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
