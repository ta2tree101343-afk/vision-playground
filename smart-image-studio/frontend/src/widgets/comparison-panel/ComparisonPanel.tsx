import { useEffect, useState } from 'react';
import { operationLabels } from '@entities/operation';
import { LoadingState } from '@shared/ui/LoadingState';
import { StatusBanner } from '@shared/ui/StatusBanner';
import type { ProcessImageResponse } from '@shared/types/api';
import { loadComparisonAssets, type ComparisonAssets } from '@entities/image';
import { ComparisonViewport } from './ComparisonViewport';
import { HistogramCard } from './HistogramCard';
import { ComparisonControls } from './ComparisonControls';
import { useComparisonTransform } from './useComparisonTransform';
import { ImageLayer } from './ImageLayer';

interface ComparisonPanelProps {
  beforeImageUrl: string | null;
  result: ProcessImageResponse | null;
}

export function ComparisonPanel({ beforeImageUrl, result }: ComparisonPanelProps) {
  const afterImageUrl = result?.processed_image_url ?? null;
  const appliedOperations = result?.applied_operations.map(
    (item) => operationLabels[item.operation] ?? item.operation,
  );
  const [mode, setMode] = useState<'sync' | 'diff'>('sync');
  const [assets, setAssets] = useState<ComparisonAssets | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [assetErrorMessage, setAssetErrorMessage] = useState<string | null>(null);

  const {
    transform,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    zoomIn,
    zoomOut,
    resetTransform,
  } = useComparisonTransform();

  useEffect(() => {
    if (!beforeImageUrl || !afterImageUrl) {
      return;
    }

    let ignore = false;

    setIsLoadingAssets(true);
    setAssetErrorMessage(null);

    void loadComparisonAssets(beforeImageUrl, afterImageUrl)
      .then((loadedAssets) => {
        if (!ignore) {
          setAssets(loadedAssets);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setAssets(null);
          setAssetErrorMessage(
            error instanceof Error && error.message.trim() !== ''
              ? error.message
              : '比較画像の準備に失敗しました。',
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingAssets(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [afterImageUrl, beforeImageUrl]);

  const hasImages = Boolean(beforeImageUrl && afterImageUrl);
  const displayAssets = hasImages ? assets : null;
  const displayErrorMessage = hasImages ? assetErrorMessage : null;

  const beforeDimensionLabel = displayAssets
    ? `${displayAssets.before.width} × ${displayAssets.before.height}`
    : undefined;
  const afterDimensionLabel = displayAssets
    ? `${displayAssets.after.width} × ${displayAssets.after.height}`
    : undefined;

  return (
    <section className="space-y-4">
      <ComparisonControls
        mode={mode}
        scale={transform.scale}
        message={result?.message}
        appliedOperations={appliedOperations}
        onSetMode={setMode}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetTransform={resetTransform}
      />

      {displayErrorMessage ? <StatusBanner message={displayErrorMessage} tone="error" /> : null}

      {displayAssets?.diagnostics ? (
        <StatusBanner message={displayAssets.diagnostics} tone="warning" />
      ) : null}

      {isLoadingAssets ? <LoadingState message="比較データを準備しています..." /> : null}

      {!isLoadingAssets && beforeImageUrl && afterImageUrl ? (
        <>
          {mode === 'sync' ? (
            <div className="grid gap-3 xl:grid-cols-2">
              <ComparisonViewport
                title="Before"
                caption="元画像"
                dimensionLabel={beforeDimensionLabel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
              >
                <ImageLayer src={beforeImageUrl} alt="Before" transform={transform} />
              </ComparisonViewport>

              <ComparisonViewport
                title="After"
                caption="処理後画像"
                dimensionLabel={afterDimensionLabel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
              >
                <ImageLayer src={afterImageUrl} alt="After" transform={transform} />
              </ComparisonViewport>
            </div>
          ) : null}

          {mode === 'diff' ? (
            <ComparisonViewport
              title="差分表示"
              caption="ピクセル差分を強調表示します。"
              dimensionLabel={beforeDimensionLabel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            >
              {displayAssets?.diffDataUrl ? (
                <ImageLayer
                  src={displayAssets.diffDataUrl}
                  alt="Difference"
                  transform={transform}
                />
              ) : (
                <div
                  className="flex h-full items-center justify-center px-6 text-center text-sm leading-6"
                  style={{ color: 'var(--text-muted)' }}
                >
                  差分画像を生成できませんでした。
                </div>
              )}
            </ComparisonViewport>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-2">
            <HistogramCard
              title="Before Histogram"
              histogram={displayAssets?.before.histogram ?? null}
            />
            <HistogramCard
              title="After Histogram"
              histogram={displayAssets?.after.histogram ?? null}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
