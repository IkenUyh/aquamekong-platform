import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Bay tới trạm đang chọn; bỏ chọn (center = null) thì lùi về khung chứa mọi trạm.
 * Chỉ chạy khi toạ độ đổi: center là mảng mới mỗi lần render, so theo giá trị để số đo mới về không kéo bản đồ lại.
 */
export function MapFlyToStation({ center, overview }: { center: [number, number] | null; overview: [number, number][] }) {
  const map = useMap();
  const focused = useRef(false);
  const lat = center?.[0];
  const lng = center?.[1];

  useEffect(() => {
    // Chọn/bỏ chọn trạm làm hiện/ẩn khung lịch sử bên dưới, khung bản đồ đổi cỡ:
    // đo lại trước khi bay, nếu không Leaflet canh theo kích thước cũ
    map.invalidateSize();
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 12, { duration: 1 });
      focused.current = true;
    } else if (focused.current && overview.length > 0) {
      map.flyToBounds(L.latLngBounds(overview), { padding: [24, 24], duration: 1 });
      focused.current = false;
    }
    // overview chỉ dùng lúc bỏ chọn, không cần chạy lại khi danh sách trạm làm mới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, map]);

  return null;
}
