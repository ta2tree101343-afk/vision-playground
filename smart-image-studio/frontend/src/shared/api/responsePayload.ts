export async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  const ct = response.headers.get('content-type') ?? '';
  return ct.includes('application/json') || ct.includes('+json') ? JSON.parse(text) : text;
}

function extractErrorMessageFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim() !== '') return payload;
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = payload.detail;
    if (typeof detail === 'string' && detail.trim() !== '') return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === 'object' && 'msg' in item ? item.msg : null,
        )
        .filter((m) => typeof m === 'string');
      if (messages.length > 0) return messages.join(' / ');
    }
  }
  return null;
}

export function buildErrorMessage(status: number, payload: unknown): string {
  return (
    extractErrorMessageFromPayload(payload) ?? `API リクエストが失敗しました（status: ${status}）。`
  );
}
