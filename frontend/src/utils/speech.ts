import type { FieldPlan } from '../api/fieldApi';
import { dayLabel } from './actionPlan';

/**
 * Đọc to kế hoạch ở chế độ Nông dân (Web Speech API, giọng tiếng Việt của máy). Ở đây chỉ dựng câu đọc: giọng đọc
 * đọc "16/11" thành "mười sáu trên mười một" và bỏ qua "‰", nên đổi sang lời nói trước.
 */

/** Số việc đọc sau câu trả lời, đọc dài quá thì người nghe khó nhớ */
export const SPOKEN_ACTIONS = 3;

/** "2026-11-16" → "ngày 16 tháng 11" */
export function spokenDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `ngày ${d} tháng ${m}`;
}

/** Đổi chữ viết sang lời đọc: ngày dd/MM, phân số pha nước, ‰, m³, khoảng số "a–b" */
export function toSpeech(text: string): string {
  return text
    // Ngày luôn có 2 chữ số (dd/MM, backend và formatDay); "ngày 16/11" không đọc "ngày" hai lần
    .replace(/(?:\b[Nn]gày\s+)?\b(\d{2})\/(\d{2})\b/g, (_, d: string, m: string) => `ngày ${Number(d)} tháng ${Number(m)}`)
    // Phần nước ao, nước sông: 1/2, 2/3...
    .replace(/\b(\d)\/(\d)\b/g, '$1 phần $2')
    .replace(/(\d)\s*[–-]\s*(\d)/g, '$1 đến $2')
    .replace(/\s*‰/g, ' phần nghìn')
    .replace(/\s*m³/g, ' mét khối')
    .replace(/\s+/g, ' ')
    .trim();
}

const endSentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/**
 * Câu đọc cho một kế hoạch: câu hỏi, câu trả lời (headline), rồi tối đa {@link SPOKEN_ACTIONS} việc đầu tiên. Việc nào
 * không tự nói ngày thì đọc ngày bắt đầu trước.
 */
export function planSpeech(plan: FieldPlan): string {
  const today = plan.waterPlan?.days[0]?.date ?? plan.actions[0]?.from ?? '';
  const parts = ['Tuần này lấy nước được không?', endSentence(plan.headline)];
  const actions = plan.actions.slice(0, SPOKEN_ACTIONS);
  if (actions.length > 0) parts.push('Việc cần làm.');
  for (const a of actions) {
    const hasDate = /\d{2}\/\d{2}/.test(a.message) || a.kind === 'TAKE_WATER';
    const when = dayLabel(a.from, today);
    parts.push(endSentence(hasDate || !a.from ? a.message : `${/^\d/.test(when) ? `Ngày ${when}` : when}: ${a.message}`));
  }
  return toSpeech(parts.join(' '));
}

/** Giọng tiếng Việt: lang "vi-VN" trước (Chrome), rồi bất kỳ "vi..." (Android có "vi_VN") */
export function pickVietnameseVoice<T extends { lang: string }>(voices: readonly T[]): T | null {
  const vi = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('vi'));
  return vi.find((v) => v.lang.toLowerCase().replace('_', '-') === 'vi-vn') ?? vi[0] ?? null;
}
