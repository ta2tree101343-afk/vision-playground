export function LoadingState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border px-5 py-10 text-center text-sm"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-default)',
        color: 'var(--text-muted)',
      }}
    >
      {message}
    </div>
  );
}
