export function MiniHistogram() {
  const bars = [4, 8, 14, 22, 35, 48, 60, 72, 78, 82, 85, 80, 72, 60, 48, 40, 32, 25, 18, 12, 8, 6, 4, 3];
  const max = Math.max(...bars);

  return (
    <div className="mt-3">
      <div className="mb-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        ヒストグラム（参考）
      </div>
      <div
        className="flex h-12 items-end gap-px overflow-hidden rounded-md"
        style={{ background: 'var(--bg-input)' }}
      >
        {bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] transition-all"
            style={{ height: `${(v / max) * 100}%`, background: 'rgba(74, 127, 240, 0.6)' }}
          />
        ))}
      </div>
    </div>
  );
}
