import type { ParameterDefinition, ParameterKey, ParameterState } from '../types/image';

interface ParameterControlsProps {
  definitions: ParameterDefinition[];
  values: ParameterState;
  onChange: (key: ParameterKey, value: number) => void;
}

export function ParameterControls({
  definitions,
  values,
  onChange,
}: ParameterControlsProps) {
  return (
    <section className="rounded-[26px] border border-white/6 bg-[#0c0d12] p-5 md:p-6">
      <div className="mb-3 flex items-center gap-4">
        <h2 className="text-[clamp(1.35rem,2.2vw,1.8rem)] font-black tracking-[-0.05em] text-white">
          パラメータ調整
        </h2>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="grid gap-3">
        {definitions.map((definition) => {
          const currentValue = values[definition.key];

          return (
            <label
              key={definition.key}
              className="block rounded-[20px] border border-white/8 bg-[#12131a] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-base font-bold text-white">{definition.label}</div>
                  <div className="mt-1 text-xs leading-6 text-[#8c879d] md:text-sm">{definition.helpText}</div>
                </div>
                <div className="rounded-full border border-[#0ee8b6]/20 bg-[#10201b] px-3 py-1 text-xs font-semibold text-[#9bf8df] md:text-sm">
                  {currentValue}
                </div>
              </div>
              <input
                className="mt-3 w-full"
                type="range"
                min={definition.min}
                max={definition.max}
                step={definition.step}
                value={currentValue}
                onChange={(event) => onChange(definition.key, Number(event.target.value))}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
