import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { ResultPage } from '@pages/result/ResultPage';
import { StudioPage } from '@pages/studio/StudioPage';
import type { AppPath } from '@shared/lib/navigation';

export function AppRoutes({ currentPath }: { currentPath: AppPath }) {
  if (currentPath === '/result') {
    return (
      <ErrorBoundary>
        <ResultPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <StudioPage />
    </ErrorBoundary>
  );
}
