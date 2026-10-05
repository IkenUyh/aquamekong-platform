import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { GeoJsonFeature } from '../../types';
import { HEAT_SCALES, type HeatMetric } from '../../utils/heatScales';

/** Lớp nhiệt theo số đo mới nhất của từng trạm cho chỉ số `metric`. */
export function MetricHeatmap({ features, metric }: { features: GeoJsonFeature[]; metric: HeatMetric }) {
  const map = useMap();

  useEffect(() => {
    const scale = HEAT_SCALES[metric];
    const points: [number, number, number][] = features.flatMap((f) => {
      const v = scale.value(f.properties);
      return v == null ? [] : [[f.geometry.coordinates[1], f.geometry.coordinates[0], Math.min(v / scale.max, 1)] as [number, number, number]];
    });
    if (points.length === 0) return;

    const heatLayer = L.heatLayer(points, { radius: 60, blur: 40, maxZoom: 12, max: 1.0, gradient: scale.gradient });

    // leaflet.heat vẽ lên canvas cỡ bằng bản đồ: khi bản đồ đang có kích thước 0 (panel thu gọn,
    // màn hình hẹp) getImageData sẽ ném lỗi -> chờ đến khi bản đồ có kích thước rồi mới thêm layer
    const addWhenSized = () => {
      const size = map.getSize();
      if (size.x > 0 && size.y > 0 && !map.hasLayer(heatLayer)) heatLayer.addTo(map);
    };
    addWhenSized();
    map.on('resize', addWhenSized);

    return () => {
      map.off('resize', addWhenSized);
      if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
    };
  }, [map, features, metric]);

  return null;
}
