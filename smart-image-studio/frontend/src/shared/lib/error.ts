export function toErrorMessage(error: unknown, fallback = String(error)): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}
