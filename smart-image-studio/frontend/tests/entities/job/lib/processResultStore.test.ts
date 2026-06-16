import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveLatestProcessResult, readLatestProcessResult } from '@entities/job/lib/processResultStore';
import type { ProcessImageResponse } from '@shared/types/api';

vi.mock('@shared/lib/sessionJson', () => ({
  readSessionJson: vi.fn(),
  writeSessionJson: vi.fn(),
  removeSessionItem: vi.fn(),
}));

vi.mock('@shared/api/__generated__/api.schemas', () => ({
  ProcessImageResponse: {
    safeParse: vi.fn(),
  },
}));

import { readSessionJson, writeSessionJson, removeSessionItem } from '@shared/lib/sessionJson';
import { ProcessImageResponse as processImageResponseSchema } from '@shared/api/__generated__/api.schemas';

const mockReadSessionJson = vi.mocked(readSessionJson);
const mockWriteSessionJson = vi.mocked(writeSessionJson);
const mockRemoveSessionItem = vi.mocked(removeSessionItem);
const mockSafeParse = vi.mocked(processImageResponseSchema.safeParse);

const VALID_RESULT: ProcessImageResponse = {
  message: 'OK',
  original_image_url: 'http://localhost/orig.jpg',
  processed_image_url: 'http://localhost/proc.jpg',
  processed_filename: 'proc.jpg',
  applied_operations: [],
  analysis: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveLatestProcessResult', () => {
  it('returns true when write succeeds', () => {
    mockWriteSessionJson.mockReturnValue(true);
    expect(saveLatestProcessResult(VALID_RESULT)).toBe(true);
  });

  it('returns false when write fails', () => {
    mockWriteSessionJson.mockReturnValue(false);
    expect(saveLatestProcessResult(VALID_RESULT)).toBe(false);
  });

  it('calls writeSessionJson with the result value', () => {
    mockWriteSessionJson.mockReturnValue(true);
    saveLatestProcessResult(VALID_RESULT);
    expect(mockWriteSessionJson).toHaveBeenCalledWith(
      'smart-image-studio/latest-result',
      VALID_RESULT,
      'processResultStore',
    );
  });
});

describe('readLatestProcessResult', () => {
  it('returns { status: "empty" } when nothing is stored', () => {
    mockReadSessionJson.mockReturnValue(null);
    expect(readLatestProcessResult()).toEqual({ status: 'empty' });
  });

  it('returns { status: "error" } when readSessionJson throws', () => {
    mockReadSessionJson.mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(readLatestProcessResult()).toEqual({ status: 'error' });
  });

  it('returns { status: "ok", value } when stored data passes Zod validation', () => {
    mockReadSessionJson.mockReturnValue(VALID_RESULT);
    mockSafeParse.mockReturnValue({ success: true, data: VALID_RESULT });

    const result = readLatestProcessResult();

    expect(result).toEqual({ status: 'ok', value: VALID_RESULT });
  });

  it('returns { status: "error" } when Zod validation fails', () => {
    mockReadSessionJson.mockReturnValue({ broken: true });
    mockSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'invalid' }] },
    } as unknown as ReturnType<typeof mockSafeParse>);

    const result = readLatestProcessResult();

    expect(result).toEqual({ status: 'error' });
  });

  it('removes the item from storage when Zod validation fails', () => {
    mockReadSessionJson.mockReturnValue({ broken: true });
    mockSafeParse.mockReturnValue({
      success: false,
      error: { issues: [] },
    } as unknown as ReturnType<typeof mockSafeParse>);

    readLatestProcessResult();

    expect(mockRemoveSessionItem).toHaveBeenCalledWith(
      'smart-image-studio/latest-result',
      'processResultStore',
    );
  });

  it('passes the stored key to readSessionJson', () => {
    mockReadSessionJson.mockReturnValue(null);
    readLatestProcessResult();
    expect(mockReadSessionJson).toHaveBeenCalledWith(
      'smart-image-studio/latest-result',
      'processResultStore',
    );
  });
});
