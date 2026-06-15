import type { ImageHistogram } from '@entities/image';

const CHART_W = 300;
const CHART_H = 110;
const PAD = { top: 6, right: 16, bottom: 20, left: 32 };
const SVG_W = PAD.left + CHART_W + PAD.right;
const SVG_H = PAD.top + CHART_H + PAD.bottom;
const X_TICKS = [0, 64, 128, 192, 255];
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1.0];

function buildHistogramPath(
  values: number[],
  maxCount: number,
  width: number,
  height: number,
): string {
  if (values.length === 0 || maxCount <= 0) {
    return '';
  }

  if (values.length === 1) {
    const y = height - (values[0] / maxCount) * height;
    return `M 0 ${y.toFixed(2)} L ${width} ${y.toFixed(2)}`;
  }

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
  if (!path) return '';
  return `${path} L ${width} ${height} L 0 ${height} Z`;
}

export function HistogramCard({
  title,
  histogram,
}: {
  title: string;
  histogram: ImageHistogram | null;
}) {
  const chart = histogram
    ? {
        red:           buildHistogramPath(histogram.red,       histogram.maxCount, CHART_W, CHART_H),
        green:         buildHistogramPath(histogram.green,     histogram.maxCount, CHART_W, CHART_H),
        blue:          buildHistogramPath(histogram.blue,      histogram.maxCount, CHART_W, CHART_H),
        luminanceArea: buildHistogramArea(histogram.luminance, histogram.maxCount, CHART_W, CHART_H),
        luminanceLine: buildHistogramPath(histogram.luminance, histogram.maxCount, CHART_W, CHART_H),
      }
    : null;

  return (
    <article
      className="rounded-2xl border p-4"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <div className="flex gap-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--chart-red)' }}>R</span>
          <span style={{ color: 'var(--chart-green)' }}>G</span>
          <span style={{ color: 'var(--chart-blue)' }}>B</span>
          <span style={{ color: 'var(--text-secondary)' }}>Luma</span>
        </div>
      </div>

      {chart ? (
        <div
          className="mt-3 rounded-xl border p-3"
          style={{ background: 'var(--bg-shell)', borderColor: 'var(--border-subtle)' }}
        >
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {Y_TICKS.map((t) => {
              const y = PAD.top + CHART_H - t * CHART_H;
              const count = histogram ? Math.round(t * histogram.maxCount) : 0;
              const label = count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : String(count);
              return (
                <g key={t}>
                  <line
                    x1={PAD.left} y1={y} x2={PAD.left + CHART_W} y2={y}
                    strokeWidth="0.8"
                    strokeDasharray={t === 0 || t === 1 ? '' : '3 2'}
                    style={{ stroke: 'var(--chart-grid)' }}
                  />
                  <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">
                    {label}
                  </text>
                </g>
              );
            })}

            <g transform={`translate(${PAD.left}, ${PAD.top})`}>
              <path d={chart.luminanceArea} style={{ fill: 'var(--chart-luma-fill)' }} />
              <path d={chart.red}           fill="none" strokeWidth="1.6" style={{ stroke: 'var(--chart-red-line)' }} />
              <path d={chart.green}         fill="none" strokeWidth="1.6" style={{ stroke: 'var(--chart-green-line)' }} />
              <path d={chart.blue}          fill="none" strokeWidth="1.6" style={{ stroke: 'var(--chart-blue-line)' }} />
              <path d={chart.luminanceLine} fill="none" strokeWidth="1.1" style={{ stroke: 'var(--chart-luma-line)' }} />
            </g>

            {X_TICKS.map((v) => {
              const x = PAD.left + (v / 255) * CHART_W;
              const y = PAD.top + CHART_H;
              return (
                <g key={v}>
                  <line x1={x} y1={y} x2={x} y2={y + 4} strokeWidth="0.8" style={{ stroke: 'var(--chart-tick)' }} />
                  <text x={x} y={y + 13} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{v}</text>
                </g>
              );
            })}

            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CHART_H} strokeWidth="0.8" style={{ stroke: 'var(--chart-axis)' }} />
            <line x1={PAD.left} y1={PAD.top + CHART_H} x2={PAD.left + CHART_W} y2={PAD.top + CHART_H} strokeWidth="0.8" style={{ stroke: 'var(--chart-axis)' }} />
          </svg>
        </div>
      ) : (
        <div
          className="mt-3 rounded-xl border px-4 py-6 text-sm"
          style={{
            background: 'var(--bg-shell)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          ヒストグラムを生成できませんでした。
        </div>
      )}
    </article>
  );
}
