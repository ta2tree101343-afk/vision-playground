import { useEffect, useState } from 'react';
import { downloadProcessedImage } from '@features/image-upload/api/imageApi';
import { AnalysisPanel } from '@widgets/analysis-panel/AnalysisPanel';
import { ComparisonPanel } from '@widgets/comparison-panel/ComparisonPanel';
import { ErrorBanner } from '@shared/ui/ErrorBanner';
import { StatusBanner } from '@shared/ui/StatusBanner';
import { clearJobNotice, readJobNotice, type JobNotice } from '@features/job-tracking/lib/jobNoticeStore';
import { navigateTo } from '@shared/lib/navigation';
import { readLatestProcessResult } from '@entities/job/lib/processResultStore';
import type { OperationStep, OperationType } from '@shared/types/api';

const ANALYSIS_ONLY_OPERATIONS = new Set<OperationType>(['ocr', 'object_detection', 'caption_generation']);

function isAnalysisOnly(operations: OperationStep[]): boolean {
  return operations.length > 0 && operations.every((op) => ANALYSIS_ONLY_OPERATIONS.has(op.operation));
}

function Topbar({
  canDownload,
  onBack,
  onDownload,
}: {
  canDownload: boolean;
  onBack: () => void;
  onDownload: () => void | Promise<void>;
}) {
  return (
    <header
      className="flex items-center justify-between border-b px-5 py-3"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <span
          className="text-sm font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif' }}
        >
          Smart Image Studio
        </span>
        <span
          className="ml-1 text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}
        >
          / Result
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition hover-text-primary"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-secondary)',
          }}
        >
          戻る
        </button>
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={!canDownload}
          className="rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: canDownload ? 'var(--accent-blue-bg-mid)' : 'var(--bg-input)',
            borderColor: canDownload ? 'var(--accent-blue)' : 'var(--border-default)',
            color: canDownload ? 'var(--accent-blue-bright)' : 'var(--text-muted)',
          }}
        >
          加工後画像をダウンロード
        </button>
      </div>
    </header>
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobNotice, setJobNotice] = useState<JobNotice | null>(null);

  useEffect(() => {
    let notice: JobNotice | null = null;
    try {
      notice = readJobNotice();
    } catch (error) {
      console.error('[ResultPage] Failed to read job notice:', error);
    }
    if (!notice) return;
    setJobNotice(notice);
    clearJobNotice();
  }, []);

  const canDownload = Boolean(result?.processed_image_url);

  async function handleDownload() {
    if (!result) return;

    setErrorMessage(null);

    try {
      const blob = await downloadProcessedImage(result.processed_image_url);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = result.processed_filename || 'processed-image.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('[ResultPage] ダウンロードに失敗しました:', error);
      setErrorMessage(
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : '加工後画像のダウンロードに失敗しました。',
      );
    }
  }

  return (
    <div
      className="studio-dark flex min-h-screen flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <Topbar
        canDownload={canDownload}
        onBack={() => navigateTo('/')}
        onDownload={handleDownload}
      />

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-4">
          {jobNotice ? <StatusBanner message={jobNotice.message} tone={jobNotice.tone} /> : null}
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

          {result ? (
            <>
              {!isAnalysisOnly(result.applied_operations) && (
                <ComparisonPanel beforeImageUrl={result.original_image_url} result={result} />
              )}
              <AnalysisPanel result={result} />
            </>
          ) : (
            <div
              className="rounded-xl border px-6 py-12 text-center"
              style={{
                background: 'var(--bg-panel)',
                borderColor: storageReadFailed ? 'var(--tone-danger-border)' : 'var(--border-default)',
              }}
            >
              <div
                className="text-lg font-semibold"
                style={{ color: storageReadFailed ? 'var(--tone-danger-text)' : 'var(--text-primary)' }}
              >
                {storageReadFailed ? '結果の読み込みに失敗しました' : 'まだ結果がありません'}
              </div>
              <div className="mt-2 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                {storageReadFailed
                  ? 'ブラウザのストレージへのアクセスが制限されています。プライベートブラウジングを無効にしてお試しください。'
                  : 'トップページで処理すると、ここに結果が表示されます。'}
              </div>
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="mt-5 rounded-lg px-5 py-2 text-sm font-semibold transition"
                style={{ background: 'var(--accent-blue)', color: 'white' }}
              >
                トップへ戻る
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
