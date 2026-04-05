interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="rounded-[24px] border border-rose-300 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-900 shadow-[0_16px_40px_-28px_rgba(40,40,40,0.25)]">
      {message}
    </div>
  );
}
