import { CROP_PHOTOS } from '../../data/cropPhotos';

/**
 * Ảnh thực tế của cây / vật nuôi (data/cropPhotos.ts, Wikimedia Commons). Mã chưa có ảnh thì hiện ô chữ cái đầu.
 * Kích thước và bo góc truyền qua className.
 */
export function CropImage({ code, name, className = '' }: { code: string; name: string; className?: string }) {
  const photo = CROP_PHOTOS[code];
  if (!photo) {
    return (
      <div className={`flex items-center justify-center bg-primary-50 font-semibold text-primary ${className}`} aria-hidden="true">
        {name.replace(/^Nuôi /, '').charAt(0)}
      </div>
    );
  }
  return (
    <img src={photo.src} alt={name} loading="lazy" decoding="async"
      title={`Ảnh: ${photo.author}, ${photo.license}`} className={`object-cover bg-gray-100 ${className}`} />
  );
}
