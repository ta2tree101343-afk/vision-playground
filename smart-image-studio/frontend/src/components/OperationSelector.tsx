import { operationOptions } from '../config/imageOperations';
import type { ImageOperationType } from '../types/api';

interface OperationSelectorProps {
  onAddOperation: (operation: ImageOperationType) => void;
}

export function OperationSelector({ onAddOperation }: OperationSelectorProps) {
  return (
    <section className="space-y-3 rounded-[26px] border border-white/6 bg-[#06070b] p-5 md:p-6">
      <div className="flex items-center gap-4">
        <h2 className="text-[clamp(1.55rem,3vw,2.2rem)] font-black tracking-[-0.05em] text-white">
          処理を追加
        </h2>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <p className="max-w-3xl text-[clamp(0.95rem,1.2vw,1.05rem)] leading-7 text-[#89859b]">
        クリックするとパイプラインにステップを追加します。
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {operationOptions.map((option) => {
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onAddOperation(option.value)}
              className="rounded-[22px] border border-white/8 bg-[#111217] px-4 py-4 text-left transition duration-200 hover:border-[#0ee8b6]/30 hover:bg-[#15161c] md:px-5 md:py-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-[#1a1b22] text-sm font-bold tracking-[0.04em] text-white md:h-14 md:w-14 md:text-base">
                {option.icon}
              </div>
              <div className="mt-3 text-[clamp(1.15rem,1.3vw,1.5rem)] font-black tracking-[-0.04em] text-white">
                {option.label}
              </div>
              <div className="mt-1.5 text-[clamp(0.88rem,1vw,0.98rem)] leading-6 text-[#8b879e]">
                {option.description}
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0ee8b6]">
                Add Step
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
