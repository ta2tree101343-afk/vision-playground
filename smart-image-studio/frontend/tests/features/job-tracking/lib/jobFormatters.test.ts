import { describe, it, expect } from 'vitest';
import { formatTimestamp, statusStyle } from '@features/job-tracking/lib/jobFormatters';

describe('formatTimestamp', () => {
  it('returns "-" for null', () => {
    expect(formatTimestamp(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatTimestamp(undefined)).toBe('-');
  });

  it('returns "-" for empty string', () => {
    expect(formatTimestamp('')).toBe('-');
  });

  it('returns "-" for an invalid date string', () => {
    expect(formatTimestamp('not-a-date')).toBe('-');
  });

  it('returns a formatted string for a valid ISO timestamp', () => {
    const result = formatTimestamp('2024-03-15T10:30:00Z');
    expect(result).not.toBe('-');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes hour and minute in the default format', () => {
    const result = formatTimestamp('2024-03-15T14:05:00Z');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('applies options overrides', () => {
    const withYear = formatTimestamp('2024-03-15T10:30:00Z', { year: 'numeric' });
    const withoutYear = formatTimestamp('2024-03-15T10:30:00Z');
    expect(withYear).not.toBe(withoutYear);
  });
});

describe('statusStyle', () => {
  it('returns warning tone styles for "queued"', () => {
    const style = statusStyle('queued');
    expect(style.borderColor).toBe('var(--tone-warning-border)');
    expect(style.background).toBe('var(--tone-warning-bg)');
    expect(style.color).toBe('var(--tone-warning-text)');
  });

  it('returns running tone styles for "running"', () => {
    const style = statusStyle('running');
    expect(style.borderColor).toBe('var(--tone-running-border)');
    expect(style.background).toBe('var(--tone-running-bg)');
    expect(style.color).toBe('var(--tone-running-text)');
  });

  it('returns info tone styles for "completed"', () => {
    const style = statusStyle('completed');
    expect(style.borderColor).toBe('var(--tone-info-border)');
    expect(style.background).toBe('var(--tone-info-bg)');
    expect(style.color).toBe('var(--tone-info-text)');
  });

  it('returns danger tone styles for "failed"', () => {
    const style = statusStyle('failed');
    expect(style.borderColor).toBe('var(--tone-danger-border)');
    expect(style.background).toBe('var(--tone-danger-bg)');
    expect(style.color).toBe('var(--tone-danger-text)');
  });

  it('returns distinct borderColors for all four statuses', () => {
    const borders = ['queued', 'running', 'completed', 'failed'].map(
      (s) => statusStyle(s as Parameters<typeof statusStyle>[0]).borderColor,
    );
    expect(new Set(borders).size).toBe(4);
  });
});
