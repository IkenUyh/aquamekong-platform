import { Link } from 'react-router-dom';
import type { FieldExposure, FieldProfile } from '../../api/fieldApi';
import { useCrops } from '../../hooks/useCrops';
import { useFieldExposure, useFields } from '../../hooks/useFields';
import { damageSummary, exposureSummary, missingHint, NOTABLE_YIELD_LOSS } from '../../utils/exposure';

const ESTIMATE_NOTE = 'Số ước tính để tham khảo, không phải thiệt hại thực tế.';

/**
 * Mức mặn cây đã chịu trong mùa của một ruộng và năng suất có thể giảm nếu tưới bằng nước ở trạm của ruộng,
 * kèm thiệt hại ước tính ra tiền. Không hiện gì khi backend không tính được (nuôi trồng thuỷ sản, nước sinh hoạt,
 * chưa gieo, cây chưa có ngưỡng).
 * compact (panel trạm trên bản đồ): tên ruộng, câu chính, số tiền và mùa; chi tiết xem ở trang Ruộng.
 */
export function ExposureBlock({ field, compact = false, className = '' }: {
  field: FieldProfile;
  compact?: boolean;
  className?: string;
}) {
  const { data: exposure, isLoading, isError } = useFieldExposure(field.stationId == null ? null : field.id);
  if (field.stationId == null || isError || (!isLoading && !exposure)) return null;
  if (isLoading || !exposure) return <p className={`text-sm text-gray-400 ${className}`}>Đang tính mức mặn cây đã chịu...</p>;

  const s = exposureSummary(exposure, field.cropName);
  const details = compact ? s.details.slice(0, 1) : s.details;
  return (
    <div className={`space-y-0.5 text-sm ${className}`}>
      {compact && <p className="text-xs font-medium text-gray-500">{field.name}</p>}
      <p className={`font-medium num ${s.severe ? 'text-red-700' : 'text-gray-900'}`}>{s.headline}</p>
      {details.map((line) => <p key={line} className="text-gray-500 num">{line}</p>)}
      {!compact && exposure.yieldLossPercent != null && (
        <p className="text-xs text-gray-400">
          Ước theo đường giảm năng suất FAO 29, độ mặn cao nhất mỗi ngày ở trạm; ngày còn lại của mùa coi như không mặn.
        </p>
      )}
      <DamageLines exposure={exposure} compact={compact} />
    </div>
  );
}

/** Thiệt hại ra tiền: luôn ghi là số ước tính; thiếu số thì nhắc nhập, không đoán */
function DamageLines({ exposure, compact }: { exposure: FieldExposure; compact: boolean }) {
  const loss = exposure.yieldLossPercent;
  if (!exposure.damage || loss == null) return null;
  const d = damageSummary(exposure.damage, loss, exposure.seasonKind);
  return (
    <div className={compact ? 'space-y-0.5' : 'mt-2 space-y-0.5 border-t border-gray-100 pt-2'}>
      {d.headline ? (
        <>
          <p className={`font-medium num ${loss >= NOTABLE_YIELD_LOSS ? 'text-red-700' : 'text-gray-900'}`}>{d.headline}</p>
          {!compact && d.details.map((line) => <p key={line} className="text-gray-500 num">{line}</p>)}
          <p className="text-xs text-gray-400">{ESTIMATE_NOTE}</p>
        </>
      ) : (
        <p className="text-gray-500">{missingHint(d.missing, compact)}</p>
      )}
    </div>
  );
}

/** Tối đa bấy nhiêu ruộng trong panel trạm; còn lại xem ở trang Ruộng */
const MAX_FIELDS_IN_PANEL = 3;

/** Khối ở panel trạm: các ruộng đã khai gần trạm này, gọn, chi tiết ở trang Ruộng */
export function StationFieldsExposure({ stationId }: { stationId: number }) {
  const { data: fields = [] } = useFields();
  const { data: crops = [] } = useCrops();
  // Chỉ cây trồng có đường năng suất / ngưỡng; nuôi tôm, cá và nước sinh hoạt không tính
  const cropCodes = new Set(crops.filter((c) => c.category === 'CROP').map((c) => c.code));
  const here = fields.filter((f) => f.stationId === stationId && cropCodes.has(f.cropCode));
  if (here.length === 0) return null;
  const mineFirst = [...here].sort((a, b) => Number(b.mine) - Number(a.mine));
  const shown = mineFirst.slice(0, MAX_FIELDS_IN_PANEL);
  const more = here.length - shown.length;

  return (
    <div className="card p-4 mb-4 space-y-3">
      <h3 className="font-semibold text-gray-800 text-sm">Mức mặn cây đã chịu</h3>
      {shown.map((f) => <ExposureBlock key={f.id} field={f} compact />)}
      <Link to="/fields" className="block text-sm font-medium text-primary hover:underline">
        {more > 0 ? `Xem chi tiết và ${more} ruộng khác ở trang Ruộng` : 'Xem chi tiết ở trang Ruộng'}
      </Link>
    </div>
  );
}
