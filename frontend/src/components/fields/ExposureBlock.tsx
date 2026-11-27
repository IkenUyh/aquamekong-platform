import { Link } from 'react-router-dom';
import type { FieldProfile } from '../../api/fieldApi';
import { useCrops } from '../../hooks/useCrops';
import { useFieldExposure, useFields } from '../../hooks/useFields';
import { exposureSummary } from '../../utils/exposure';

/**
 * Mức mặn cây đã chịu trong mùa của một ruộng và năng suất có thể giảm nếu tưới bằng nước ở trạm của ruộng.
 * Không hiện gì khi backend không tính được (nuôi trồng thuỷ sản, nước sinh hoạt, chưa gieo, cây chưa có ngưỡng).
 */
export function ExposureBlock({ field, showName = false, className = '' }: {
  field: FieldProfile;
  showName?: boolean;
  className?: string;
}) {
  const { data: exposure, isLoading, isError } = useFieldExposure(field.stationId == null ? null : field.id);
  if (field.stationId == null || isError || (!isLoading && !exposure)) return null;
  if (isLoading || !exposure) return <p className={`text-sm text-gray-400 ${className}`}>Đang tính mức mặn cây đã chịu...</p>;

  const s = exposureSummary(exposure, field.cropName);
  return (
    <div className={`space-y-0.5 text-sm ${className}`}>
      {showName && <p className="text-xs font-medium text-gray-500">{field.name}</p>}
      <p className={`font-medium num ${s.severe ? 'text-red-700' : 'text-gray-900'}`}>{s.headline}</p>
      {s.details.map((line) => <p key={line} className="text-gray-500 num">{line}</p>)}
      {exposure.yieldLossPercent != null && (
        <p className="text-xs text-gray-400">
          Ước theo đường giảm năng suất FAO 29, độ mặn cao nhất mỗi ngày ở trạm; ngày còn lại của mùa coi như không mặn.
        </p>
      )}
    </div>
  );
}

/** Tối đa bấy nhiêu ruộng trong panel trạm; còn lại xem ở trang Ruộng */
const MAX_FIELDS_IN_PANEL = 3;

/** Khối ở panel trạm: các ruộng đã khai gần trạm này và năng suất có thể giảm của từng ruộng */
export function StationFieldsExposure({ stationId }: { stationId: number }) {
  const { data: fields = [] } = useFields();
  const { data: crops = [] } = useCrops();
  // Chỉ cây trồng có đường năng suất / ngưỡng; nuôi tôm, cá và nước sinh hoạt không tính
  const cropCodes = new Set(crops.filter((c) => c.category === 'CROP').map((c) => c.code));
  const here = fields.filter((f) => f.stationId === stationId && cropCodes.has(f.cropCode));
  if (here.length === 0) return null;
  const mineFirst = [...here].sort((a, b) => Number(b.mine) - Number(a.mine));
  const shown = mineFirst.slice(0, MAX_FIELDS_IN_PANEL);

  return (
    <div className="card p-4 mb-4 space-y-3">
      <h3 className="font-semibold text-gray-800 text-sm">Mức mặn cây đã chịu</h3>
      {shown.map((f) => <ExposureBlock key={f.id} field={f} showName />)}
      {here.length > shown.length && (
        <Link to="/fields" className="block text-sm font-medium text-primary hover:underline">
          Xem thêm {here.length - shown.length} ruộng khác ở trang Ruộng
        </Link>
      )}
    </div>
  );
}
