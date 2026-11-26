import type { Crop } from '../../api/cropApi';
import { CROP_PHOTOS } from '../../data/cropPhotos';

/** Ghi nguồn ảnh: giấy phép CC BY / CC BY-SA bắt buộc nêu tác giả, giấy phép và nơi lấy ảnh */
export function PhotoCredits({ crops }: { crops: Crop[] }) {
  const names = new Map(crops.map((c) => [c.code, c.name]));
  const entries = Object.entries(CROP_PHOTOS).sort(([a], [b]) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b, 'vi'));
  return (
    <details className="text-xs text-gray-500">
      <summary className="cursor-pointer select-none">Nguồn ảnh (Wikimedia Commons)</summary>
      <ul className="mt-2 space-y-1">
        {entries.map(([code, p]) => (
          <li key={code}>
            {names.get(code) ?? code}:{' '}
            <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary">ảnh</a>
            {' '}của {p.author},{' '}
            {p.licenseUrl
              ? <a href={p.licenseUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary">{p.license}</a>
              : p.license}
          </li>
        ))}
      </ul>
    </details>
  );
}
