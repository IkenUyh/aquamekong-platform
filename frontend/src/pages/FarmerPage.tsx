import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FarmerAnswer } from '../components/farmer/FarmerAnswer';
import { FarmerSetup } from '../components/farmer/FarmerSetup';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { useCrops } from '../hooks/useCrops';
import { useFarmerMode } from '../hooks/useFarmerMode';
import { useFieldPlan, useFields, useQuickPlan } from '../hooks/useFields';
import { useStationsList } from '../hooks/useStations';
import { BIG_BUTTON } from '../utils/farmerMode';

/**
 * Chế độ Nông dân (/nong-dan): một màn hình trả lời "Tuần này lấy nước được không?". Bố cục riêng, chữ lớn, không
 * bản đồ, không biểu đồ (không tải Leaflet/Recharts). Lựa chọn trạm + cây lưu trên máy; kế hoạch lấy từ
 * GET /plan/quick (không tạo ruộng), hoặc GET /fields/{id}/plan khi dùng ruộng đã khai.
 */
export function FarmerPage() {
  const { user } = useAuth();
  const { choice, setChoice, setOn } = useFarmerMode();
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const { data: stations = [] } = useStationsList();
  const { data: crops = [] } = useCrops();
  // Chỉ tài khoản đã đăng nhập mới có "ruộng của tôi" (ruộng dùng chung, khách không có ruộng riêng)
  const { data: allFields = [] } = useFields(!!user);
  const myFields = user ? allFields.filter((f) => f.mine && f.stationId != null) : [];

  const fieldId = choice?.fieldId ?? null;
  const fieldPlan = useFieldPlan(fieldId);
  const quickPlan = useQuickPlan(choice && fieldId == null ? {
    stationId: choice.stationId,
    cropCode: choice.cropCode,
    ...(choice.plantedOn ? { plantedOn: choice.plantedOn } : {}),
    ...(choice.varietyDays ? { varietyDays: choice.varietyDays } : {}),
  } : null);
  const q = fieldId != null ? fieldPlan : quickPlan;

  const crop = crops.find((c) => c.code === choice?.cropCode);
  const station = stations.find((s) => s.id === choice?.stationId);
  const field = fieldId == null ? undefined : allFields.find((f) => f.id === fieldId);
  const title = field
    ? `${field.name} · ${field.cropName} · trạm ${field.stationName}`
    : [crop?.name, station && `trạm ${station.name}`].filter(Boolean).join(' · ');

  const leave = () => {
    setOn(false);
    navigate('/');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-lg text-gray-900">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-2 bg-primary px-4 py-2">
        <Logo tone="light" textClassName="hidden min-[400px]:inline" />
        <button type="button" onClick={leave}
          className={`${BIG_BUTTON} border-2 border-white/60 text-white hover:bg-white/10`}>
          Về chế độ đầy đủ
        </button>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {!choice && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Tuần này lấy nước được không?</h1>
            <p className="mt-1 text-lg text-gray-700">Chọn trạm và cây một lần, lần sau mở ra là thấy câu trả lời.</p>
          </div>
        )}
        {!choice || editing ? (
          <FarmerSetup stations={stations} crops={crops} fields={myFields} initial={choice}
            onDone={(c) => { setChoice(c); setEditing(false); window.scrollTo?.(0, 0); }}
            onCancel={choice ? () => setEditing(false) : undefined} />
        ) : (
          <FarmerAnswer plan={q.data} isLoading={q.isLoading} error={q.error} crop={crop} station={station}
            title={title} updatedAt={q.dataUpdatedAt}
            onChange={() => { setEditing(true); window.scrollTo?.(0, 0); }}
            onRetry={() => { void q.refetch(); }} />
        )}
      </main>
    </div>
  );
}
