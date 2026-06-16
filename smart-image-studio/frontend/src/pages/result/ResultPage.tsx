import { useState } from 'react';
import { AnalysisPanel } from '@widgets/analysis-panel';
import { ComparisonPanel } from '@widgets/comparison-panel';
import { ResultTopbar } from '@widgets/result-topbar';
import { EmptyState } from '@shared/ui/EmptyState';
import { ErrorBanner } from '@shared/ui/ErrorBanner';
import { navigateTo } from '@shared/lib/navigation';
import { readLatestProcessResult } from '@entities/job';
import type { OperationStep, OperationType } from '@shared/types/api';
import { useResultDownload } from './useResultDownload';

const ANALYSIS_ONLY_OPERATIONS = new Set<OperationType>([
  'ocr',
  'object_detection',
  'caption_generation',
]);

function isAnalysisOnly(operations: OperationStep[]): boolean {
  return (
    operations.length > 0 && operations.every((op) => ANALYSIS_ONLY_OPERATIONS.has(op.operation))
  );
}

export function ResultPage() {
  const [{ result, storageReadFailed }] = useState(() => {
    const outcome = readLatestProcessResult();
    return {
      result: outcome.status === 'ok' ? outcome.value : null,
      storageReadFailed: outcome.status === 'error',
    };
  });
  const { errorMessage, canDownload, handleDownload } = useResultDownload(result);

  return (
    <div
      className="studio-dark flex h-screen flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <ResultTopbar
        canDownload={canDownload}
        onBack={() => navigateTo('/')}
        onDownload={handleDownload}
      />

      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ minHeight: 0 }}>
        <div className="space-y-4">
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

          {result ? (
            <>
              {!isAnalysisOnly(result.applied_operations) && (
                <ComparisonPanel beforeImageUrl={result.original_image_url} result={result} />
              )}
              <AnalysisPanel result={result} />
            </>
          ) : (
            <EmptyState
              variant="page"
              tone={storageReadFailed ? 'error' : 'default'}
              message={
                storageReadFailed
                  ? 'ブラウザのストレージへのアクセスが制限されています。プライベートブラウジングを無効にしてお試しください。'
                  : 'まだ結果がありません'
              }
              action={
                storageReadFailed
                  ? undefined
                  : { label: 'トップへ戻る', onClick: () => navigateTo('/') }
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
