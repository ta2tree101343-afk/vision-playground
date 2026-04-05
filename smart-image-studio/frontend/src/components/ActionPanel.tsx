interface ActionPanelProps {
  canProcess: boolean;
  isProcessing: boolean;
  stepCount: number;
  onProcess: () => void | Promise<void>;
}

export function ActionPanel({
  canProcess,
  isProcessing,
  stepCount,
  onProcess,
}: ActionPanelProps) {
  return (
    <section className="space-y-2">
      <div className="text-sm text-zinc-400">
        {stepCount > 0
          ? `${stepCount} ステップを順番に実行します。`
          : '処理を追加すると、ここからまとめて実行できます。'}
      </div>
      <button
        type="button"
        onClick={() => void onProcess()}
        disabled={!canProcess || isProcessing}
        className="inline-flex w-full items-center justify-center rounded-[22px] bg-[#22734f] px-5 py-4 text-[clamp(1.2rem,2vw,1.75rem)] font-black tracking-[-0.05em] text-black transition hover:bg-[#2b8f61] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 md:py-5"
      >
        {isProcessing ? '処理中...' : '実行する'}
      </button>
    </section>
  );
}
