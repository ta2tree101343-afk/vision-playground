import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';

afterEach(cleanup);

// Suppress React's error boundary console.error noise in tests.
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <span>child content</span>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('child content')).toBeDefined();
  });

  it('renders the custom fallback when an error is thrown and fallback is provided', () => {
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeDefined();
    expect(screen.queryByText('child content')).toBeNull();
  });

  it('renders the default error UI when no fallback is provided', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('default error UI contains the reload button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'ページを再読み込み' })).toBeDefined();
  });

  it('default error UI contains the error heading', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('予期しないエラーが発生しました')).toBeDefined();
  });

  it('does not render children after an error is caught', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('child content')).toBeNull();
  });
});
