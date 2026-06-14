import { StatusBanner } from './StatusBanner';

export function ErrorBanner({ message }: { message: string }) {
  return <StatusBanner message={message} tone="error" />;
}
