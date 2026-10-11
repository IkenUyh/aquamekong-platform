import { describe, expect, it } from 'vitest';
import { formatDay, formatMeasuredAt, formatSalinity, isReporting, ONLINE_WINDOW_MS } from './salinity';

describe('formatMeasuredAt', () => {
  it('shows only the date for daily readings stamped at midnight', () => {
    const iso = new Date(2026, 9, 7, 0, 0).toISOString();
    // dd/MM như ngày đủ năm, không theo ICU vi-VN ("07-10")
    expect(formatMeasuredAt(iso)).toBe('ngày 07/10');
    expect(formatMeasuredAt(iso, false)).toBe('07/10');
    expect(formatMeasuredAt(iso, false, true)).toBe('07/10/2026');
  });

  it('keeps the time for readings taken during the day', () => {
    expect(formatMeasuredAt(new Date(2026, 9, 7, 14, 30).toISOString())).toBe('lúc 14:30 07/10');
  });
});

describe('formatDay', () => {
  it('formats a plain date like the daily readings, without shifting it by the timezone', () => {
    expect(formatDay('2026-10-08')).toBe('08/10');
  });
});

describe('formatSalinity', () => {
  it('always shows two decimals so one reading looks the same on every screen', () => {
    expect(formatSalinity(1.9)).toBe('1,90');
    expect(formatSalinity(24.37)).toBe('24,37');
    expect(formatSalinity(null)).toBe('—');
  });
});

describe('isReporting', () => {
  it('still counts a daily station whose latest reading is the day before yesterday', () => {
    // Số liệu ngày 07/10 (00:00) về sáng 08/10; tới gần sáng 09/10 vẫn là số mới nhất (~54 giờ)
    const now = new Date(2026, 9, 9, 5, 59).getTime();
    expect(isReporting(new Date(2026, 9, 7, 0, 0).toISOString(), now)).toBe(true);
    expect(isReporting(new Date(now - ONLINE_WINDOW_MS - 1).toISOString(), now)).toBe(false);
  });
});
