import type { AlertDto } from '../types';

/**
 * Cảnh báo có diễn ra trong khoảng từ `since` (ms) tới nay không: chưa xử lý thì luôn có (vẫn đang diễn ra, dù bắt đầu
 * từ trước), đã xử lý thì phải còn mở tới sau `since`. Lọc theo ngày bắt đầu sẽ làm mất cảnh báo kéo dài nhiều ngày.
 */
export function activeSince(alert: AlertDto, since: number): boolean {
  if (alert.status !== 'RESOLVED') return true;
  return new Date(alert.resolvedAt ?? alert.createdAt).getTime() >= since;
}
