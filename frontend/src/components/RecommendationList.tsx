import React from 'react';
import type { RecommendationDto } from '../api/recommendationApi';

const PRIORITY: Record<RecommendationDto['priority'], { label: string; border: string; text: string }> = {
  HIGH: { label: 'Ưu tiên cao', border: 'border-l-red-500', text: 'text-red-700' },
  MEDIUM: { label: 'Nên thực hiện', border: 'border-l-yellow-500', text: 'text-yellow-800' },
  LOW: { label: 'Tham khảo', border: 'border-l-gray-300', text: 'text-gray-500' },
};

/** Danh sách khuyến nghị: viền trái theo mức ưu tiên + nhãn chữ, không icon. */
export function RecommendationList({ items }: { items: RecommendationDto[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">Chưa có khuyến nghị.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((rec, i) => {
        const p = PRIORITY[rec.priority] ?? PRIORITY.LOW;
        return (
          <li key={i} className={`border-l-4 ${p.border} bg-gray-50 rounded-r-md px-3 py-2`}>
            <p className={`text-xs font-medium ${p.text}`}>{p.label}</p>
            <p className="text-sm text-gray-800 leading-snug">{rec.message}</p>
          </li>
        );
      })}
    </ul>
  );
}
