import type { CSSProperties } from 'react';
import type { ParameterKey } from '@entities/pipeline';

export function InspectorSlider({
  label,
  paramKey,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  paramKey: ParameterKey;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (key: ParameterKey, value: number) => void;
}) {
  const range = max - min;
  const pct = range > 0 ? ((value - min) / range) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span
          className="font-mono-val text-[11px] tabular-nums"
          style={{ color: 'var(--text-primary)', minWidth: '3.5em', textAlign: 'right' }}
        >
          {value.toFixed(2)}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(paramKey, Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ ['--range-fill' as string]: `${pct}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}
