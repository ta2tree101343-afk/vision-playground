import type { ChangeEvent } from 'react';

interface UploadPanelProps {
  fileName?: string;
  previewUrl: string | null;
  isBusy: boolean;
  onFileSelect: (file: File | null) => void;
}

function UploadGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="m7 9 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15.5v2A2.5 2.5 0 0 0 7.5 20h9A2.5 2.5 0 0 0 19 17.5v-2" strokeLinecap="round" />
    </svg>
  );
}

export function UploadPanel({
  fileName,
  previewUrl,
  isBusy,
  onFileSelect,
}: UploadPanelProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFileSelect(event.target.files?.[0] ?? null);
  }

  return (
    <section className="rounded-[26px] border border-white/6 bg-[#090a0e] p-5 shadow-[0_30px_90px_-55px_rgba(0,0,0,0.95)] md:p-6">
      <label className="block cursor-pointer rounded-[24px] border-2 border-dashed border-white/14 bg-[#101015] px-5 py-8 text-center transition hover:border-[#0ee8b6]/45 hover:bg-[#121319] md:px-8 md:py-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#0ee8b6]/20 bg-[#10201b] text-[#0ee8b6] shadow-[inset_0_0_0_1px_rgba(14,232,182,0.08)]">
          <UploadGlyph />
        </div>
        <div className="mt-5">
          <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-black tracking-[-0.05em] text-white">
            写真をアップロード
          </h2>
          <p className="mt-2 text-[clamp(0.95rem,1.4vw,1.15rem)] font-medium text-[#908ca4]">
            タップして選択、またはドラッグ＆ドロップ
          </p>
          <p className="mt-1 text-[clamp(0.9rem,1.2vw,1rem)] font-semibold text-[#7d7891]">
            PNG・JPG・WebP 対応
          </p>
        </div>
        <input
          className="hidden"
          type="file"
          accept="image/*"
          onChange={handleChange}
          disabled={isBusy}
        />
      </label>

      {fileName ? (
        <div className="mt-4 rounded-[18px] border border-white/10 bg-[#111218] px-4 py-3 text-sm text-zinc-300">
          選択中: {fileName}
        </div>
      ) : null}

      {previewUrl ? (
        <div className="mt-3 overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0e12]">
          <img
            src={previewUrl}
            alt="アップロード画像プレビュー"
            className="h-32 w-full object-contain bg-[#111218] md:h-40"
          />
        </div>
      ) : null}
    </section>
  );
}
