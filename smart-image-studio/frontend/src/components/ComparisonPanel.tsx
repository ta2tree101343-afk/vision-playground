import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';
import { operationLabels } from '../config/imageOperations';
import type { ProcessImageResponse } from '../types/api';
import {
  loadComparisonAssets,
  type ComparisonAssets,
  type ImageHistogram,
} from '../utils/imageComparison';

interface ComparisonPanelProps {
  beforeImageUrl: string | null;
  result: ProcessImageResponse | null;
}

type CompareMode = 'sync' | 'diff';

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const defaultTransform: ViewTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildTransformStyle(transform: ViewTransform): CSSProperties {
  return {
    transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
    transformOrigin: 'center center',
  };
}

function buildHistogramPath(
  values: number[],
  maxCount: number,
  width: number,
  height: number,
): string {
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / maxCount) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildHistogramArea(
  values: number[],
  maxCount: number,
  width: number,
  height: number,
): string {
  const path = buildHistogramPath(values, maxCount, width, height);
  return `${path} L ${width} ${height} L 0 ${height} Z`;
}

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
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-[#d7e9df] bg-[#edf7f2] text-[#1f6a50]'
          : 'border-[#d9d1c4] bg-white text-[#4f473d] hover:bg-[#f4efe7]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function ImageLayer({
  src,
  alt,
  transform,
  clipPath,
}: {
  src: string;
  alt: string;
  transform: ViewTransform;
  clipPath?: string;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={clipPath ? { clipPath } : undefined}
    >
      <div className="absolute inset-0" style={buildTransformStyle(transform)}>
        <img
          src={src}
          alt={alt}
          crossOrigin="anonymous"
          draggable={false}
          className="h-full w-full select-none object-contain pointer-events-none"
        />
      </div>
    </div>
  );
}

function ComparisonViewport({
  title,
  caption,
  dimensionLabel,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
}: {
  title: string;
  caption: string;
  dimensionLabel?: string;
  children: ReactNode;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
}) {
  return (
    <article className="rounded-[24px] border border-[#d9d1c4] bg-white p-4 shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#1f1f1f]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#7f776b]">{caption}</p>
        </div>
        {dimensionLabel ? (
          <div className="rounded-full border border-[#d9d1c4] bg-[#fcfbf8] px-3 py-1 text-xs text-[#6a6458]">
            {dimensionLabel}
          </div>
        ) : null}
      </div>

      <div
        className="relative h-[22rem] overflow-hidden rounded-[20px] border border-[#e5ded1] bg-[#f3efe8] select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {children}
      </div>
    </article>
  );
}

function HistogramCard({
  title,
  histogram,
}: {
  title: string;
  histogram: ImageHistogram | null;
}) {
  const chartWidth = 320;
  const chartHeight = 118;

  const chart = useMemo(() => {
    if (!histogram) {
      return null;
    }

    return {
      red: buildHistogramPath(histogram.red, histogram.maxCount, chartWidth, chartHeight),
      green: buildHistogramPath(histogram.green, histogram.maxCount, chartWidth, chartHeight),
      blue: buildHistogramPath(histogram.blue, histogram.maxCount, chartWidth, chartHeight),
      luminanceArea: buildHistogramArea(
        histogram.luminance,
        histogram.maxCount,
        chartWidth,
        chartHeight,
      ),
      luminanceLine: buildHistogramPath(
        histogram.luminance,
        histogram.maxCount,
        chartWidth,
        chartHeight,
      ),
    };
  }, [histogram]);

  return (
    <article className="rounded-[22px] border border-[#d9d1c4] bg-white p-4 shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-[#1f1f1f]">{title}</h3>
        <div className="flex gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8f887d]">
          <span className="text-red-300">R</span>
          <span className="text-emerald-300">G</span>
          <span className="text-sky-300">B</span>
          <span className="text-[#1f1f1f]">Luma</span>
        </div>
      </div>

      {chart ? (
        <div className="mt-3 rounded-[18px] border border-[#e5ded1] bg-[#fcfbf8] p-3">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-32 w-full"
            preserveAspectRatio="none"
          >
            <path d={chart.luminanceArea} fill="rgba(31,31,31,0.08)" />
            <path d={chart.red} fill="none" stroke="rgba(252,165,165,0.95)" strokeWidth="1.6" />
            <path
              d={chart.green}
              fill="none"
              stroke="rgba(134,239,172,0.95)"
              strokeWidth="1.6"
            />
            <path d={chart.blue} fill="none" stroke="rgba(125,211,252,0.95)" strokeWidth="1.6" />
            <path
              d={chart.luminanceLine}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1.1"
            />
          </svg>
        </div>
      ) : (
        <div className="mt-3 rounded-[18px] border border-[#e5ded1] bg-[#fcfbf8] px-4 py-6 text-sm text-[#7f776b]">
          ヒストグラムを生成できませんでした。
        </div>
      )}
    </article>
  );
}

export function ComparisonPanel({
  beforeImageUrl,
  result,
}: ComparisonPanelProps) {
  const afterImageUrl = result?.processed_image_url ?? null;
  const appliedOperations = result?.applied_operations.map(
    (item) => operationLabels[item.operation],
  );
  const [mode, setMode] = useState<CompareMode>('sync');
  const [transform, setTransform] = useState<ViewTransform>(defaultTransform);
  const [assets, setAssets] = useState<ComparisonAssets | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [assetErrorMessage, setAssetErrorMessage] = useState<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!beforeImageUrl || !afterImageUrl) {
      setAssets(null);
      setAssetErrorMessage(null);
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

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.offsetX,
      originY: transform.offsetY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    setTransform((current) => ({
      ...current,
      offsetX: (dragRef.current?.originX ?? current.offsetX) + deltaX,
      offsetY: (dragRef.current?.originY ?? current.offsetY) + deltaY,
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    setTransform((current) => ({
      ...current,
      scale: clamp(current.scale + (event.deltaY < 0 ? 0.14 : -0.14), 1, 5),
    }));
  }

  function zoomIn() {
    setTransform((current) => ({
      ...current,
      scale: clamp(current.scale + 0.2, 1, 5),
    }));
  }

  function zoomOut() {
    setTransform((current) => ({
      ...current,
      scale: clamp(current.scale - 0.2, 1, 5),
    }));
  }

  function resetTransform() {
    setTransform(defaultTransform);
  }

  const beforeDimensionLabel = assets
    ? `${assets.before.width} × ${assets.before.height}`
    : undefined;
  const afterDimensionLabel = assets
    ? `${assets.after.width} × ${assets.after.height}`
    : undefined;

  return (
    <section className="space-y-4">
      <div className="rounded-[26px] border border-[#d9d1c4] bg-white p-5 shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#8f887d]">Workspace</div>
            <h2 className="mt-1.5 text-xl font-semibold text-[#1f1f1f]">Before / After 比較</h2>
            <p className="mt-2 text-sm leading-6 text-[#6a6458]">
              同期比較と差分表示を切り替えられます。
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <ToolButton
                label="同期比較"
                active={mode === 'sync'}
                onClick={() => setMode('sync')}
              />
              <ToolButton
                label="差分表示"
                active={mode === 'diff'}
                onClick={() => setMode('diff')}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-[#6a6458]">
              <ToolButton label="−" onClick={zoomOut} />
              <div className="rounded-full border border-[#d9d1c4] bg-[#fcfbf8] px-3 py-1.5 text-xs font-semibold text-[#1f1f1f]">
                Zoom {(transform.scale * 100).toFixed(0)}%
              </div>
              <ToolButton label="+" onClick={zoomIn} />
              <ToolButton label="Reset" onClick={resetTransform} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#e5ded1] bg-[#fcfbf8] px-4 py-3 text-sm text-[#6a6458]">
          <div>
            <div className="font-medium text-[#1f1f1f]">処理状況</div>
            <div className="mt-1">{result?.message ?? '未実行です。'}</div>
            {appliedOperations && appliedOperations.length > 0 ? (
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#8f887d]">
                {appliedOperations.join(' / ')}
              </div>
            ) : null}
          </div>
          <div className="text-xs leading-6 text-[#8f887d]">
            ドラッグでパン、ホイールまたはボタンでズーム
          </div>
        </div>
      </div>

      {assetErrorMessage ? (
        <div className="rounded-[22px] border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {assetErrorMessage}
        </div>
      ) : null}

      {assets?.diagnostics ? (
        <div className="rounded-[22px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {assets.diagnostics}
        </div>
      ) : null}

      {isLoadingAssets ? (
        <div className="rounded-[24px] border border-[#d9d1c4] bg-white px-5 py-10 text-sm text-[#6a6458] shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
          比較データを準備しています...
        </div>
      ) : null}

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
              {assets?.diffDataUrl ? (
                <ImageLayer src={assets.diffDataUrl} alt="Difference" transform={transform} />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-6 text-[#7f776b]">
                  差分画像を生成できませんでした。
                </div>
              )}
            </ComparisonViewport>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-2">
            <HistogramCard title="Before Histogram" histogram={assets?.before.histogram ?? null} />
            <HistogramCard title="After Histogram" histogram={assets?.after.histogram ?? null} />
          </div>
        </>
      ) : null}
    </section>
  );
}
