import React from 'react';
import type { RecommendationDto } from '../api/recommendationApi';

const PRIORITY: Record<RecommendationDto['priority'], { label: string; dot: string; text: string }> = {
  HIGH: { label: 'Ưu tiên cao', dot: 'bg-red-500', text: 'text-red-700' },
  MEDIUM: { label: 'Nên thực hiện', dot: 'bg-yellow-500', text: 'text-yellow-800' },
  LOW: { label: 'Tham khảo', dot: 'bg-gray-400', text: 'text-gray-500' },
};

/** Danh sách khuyến nghị: chấm + nhãn mức ưu tiên (như StatusBadge), không viền trái, không icon. */
export function RecommendationList({ items }: { items: RecommendationDto[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">Chưa có khuyến nghị.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((rec, i) => {
        const p = PRIORITY[rec.priority] ?? PRIORITY.LOW;
        return (
          <li key={i} className="bg-gray-50 rounded-md px-3 py-2">
            <p className={`flex items-center gap-1.5 text-xs font-medium ${p.text}`}><span className={`dot ${p.dot}`} />{p.label}</p>
            <p className="text-sm text-gray-800 leading-snug">{rec.message}</p>
          </li>
        );
      })}
    </ul>
  );
}
