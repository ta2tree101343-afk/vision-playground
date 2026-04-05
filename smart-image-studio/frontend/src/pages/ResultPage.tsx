import { useEffect, useMemo, useState } from 'react';
import { downloadProcessedImage } from '../api/imageApi';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { ComparisonPanel } from '../components/ComparisonPanel';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusBanner } from '../components/StatusBanner';
import type { ProcessImageResponse } from '../types/api';
import { clearJobNotice, readJobNotice, type JobNotice } from '../utils/jobNoticeStore';
import { navigateTo } from '../utils/navigation';
import { readLatestProcessResult } from '../utils/processResultStore';

function ResultPageHeader({
  hasResult,
  onBack,
  onDownload,
}: {
  hasResult: boolean;
  onBack: () => void;
  onDownload: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm uppercase tracking-[0.34em] text-[#8f877b]">Result</div>
        <h1 className="mt-1.5 text-[clamp(1.6rem,3vw,2.8rem)] font-black tracking-[-0.08em] text-[#1f1f1f]">
          Before<span className="text-[#1f6a50]">After</span>
        </h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[#d9d1c4] bg-white px-4 py-2.5 text-sm font-semibold text-[#2c2924] transition hover:bg-[#f4efe7]"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={!hasResult}
          className="rounded-full border border-[#d7e9df] bg-[#edf7f2] px-4 py-2.5 text-sm font-semibold text-[#1f6a50] transition hover:bg-[#e2f2eb] disabled:cursor-not-allowed disabled:border-[#ddd5c8] disabled:bg-[#f4efe7] disabled:text-[#9e978b]"
        >
          加工後画像をダウンロード
        </button>
      </div>
    </div>
  );
}

export function ResultPage() {
  const initialResult = useMemo(() => readLatestProcessResult(), []);
  const [result] = useState<ProcessImageResponse | null>(initialResult);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobNotice, setJobNotice] = useState<JobNotice | null>(null);

  useEffect(() => {
    const notice = readJobNotice();

    if (!notice) {
      return;
    }

    setJobNotice(notice);
    clearJobNotice();
  }, []);

  async function handleDownload() {
    if (!result) {
      return;
    }

    try {
      const blob = await downloadProcessedImage(result.processed_image_url);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = objectUrl;
      link.download = result.processed_filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : '加工後画像のダウンロードに失敗しました。',
      );
    }
  }

  return (
    <main className="studio-shell min-h-screen bg-[#f3efe6] text-[#1f1f1f]">
      <div className="min-h-screen px-4 py-4 md:px-5 md:py-4">
        <ResultPageHeader
          hasResult={Boolean(result)}
          onBack={() => navigateTo('/')}
          onDownload={handleDownload}
        />

        <div className="mt-5 space-y-4">
          {jobNotice ? <StatusBanner message={jobNotice.message} tone={jobNotice.tone} /> : null}
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

          {result ? (
            <>
              <ComparisonPanel beforeImageUrl={result.original_image_url} result={result} />
              <AnalysisPanel result={result} />
            </>
          ) : (
            <div className="rounded-[28px] border border-[#d9d1c4] bg-white px-6 py-12 text-center shadow-[0_16px_40px_-28px_rgba(40,40,40,0.25)]">
              <div className="text-2xl font-bold tracking-[-0.04em] text-[#1f1f1f]">
                まだ結果がありません
              </div>
              <div className="mt-3 text-base leading-7 text-[#6a6458]">
                トップページで処理すると、ここに結果が表示されます。
              </div>
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="mt-6 rounded-full bg-[#1f6a50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#255f4c]"
              >
                トップへ戻る
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
