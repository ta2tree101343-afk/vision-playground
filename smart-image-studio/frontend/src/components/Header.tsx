export function Header() {
  return (
    <header>
      <div className="flex items-center justify-between gap-4">
        <div className="text-[clamp(2.1rem,5vw,3.6rem)] font-black tracking-[-0.09em] text-white">
          Image
          <span className="text-[#0ee8b6]">Lab</span>
        </div>

        <div className="rounded-full border border-[#0ee8b6]/35 bg-[#0b1512] px-3 py-1.5 text-xs font-semibold text-[#0ee8b6] shadow-[0_0_0_1px_rgba(14,232,182,0.05)] md:px-4 md:py-2 md:text-sm">
          v2.0
        </div>
      </div>
    </header>
  );
}
