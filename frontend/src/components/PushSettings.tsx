import { usePushNotifications } from '../hooks/usePushNotifications';
import { isNativeApp } from '../platform';
import { webPushSupported } from '../push/pushDevice';

const DENIED_HINT = isNativeApp
  ? 'Thông báo đang bị chặn. Mở Cài đặt điện thoại → Ứng dụng → AquaMekong → Thông báo để cho phép lại.'
  : 'Trang này đang bị chặn thông báo. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → Thông báo → Cho phép, rồi tải lại trang.';

const UNSUPPORTED_HINT = 'Trình duyệt này không hỗ trợ thông báo. Trên iPhone/iPad: mở trang bằng Safari, chọn Chia sẻ → Thêm vào MH chính, rồi mở từ biểu tượng đó.';

/** Bật/tắt thông báo cảnh báo trên thiết bị đang dùng. compact: một dòng, dùng ở trang Cảnh báo. */
export function PushSettings({ compact = false }: { compact?: boolean }) {
  const { available, state, busy, error, message, enable, disable, test } = usePushNotifications();

  if (compact) {
    if (!available || state === null) return null;
    return (
      <div className="space-y-2">
        {state === 'on' ? (
          <p className="text-sm text-gray-600 flex items-center gap-2"><span className="dot bg-primary-500" /> Đang nhận thông báo trên thiết bị này</p>
        ) : state === 'denied' ? (
          <p className="text-xs text-gray-500">{DENIED_HINT}</p>
        ) : (
          <button type="button" disabled={busy} onClick={() => void enable()} className="btn-secondary w-full">
            {busy ? 'Đang bật...' : 'Nhận thông báo khi có cảnh báo mới'}
          </button>
        )}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Thông báo cảnh báo</h2>
        <p className="mt-1 text-sm text-gray-500">
          Nhận thông báo trên {isNativeApp ? 'điện thoại' : 'thiết bị'} này ngay khi có cảnh báo độ mặn mới, kể cả khi không mở {isNativeApp ? 'app' : 'trang'}.
        </p>
      </div>

      {!isNativeApp && !webPushSupported() ? (
        <p className="text-sm text-gray-600">{UNSUPPORTED_HINT}</p>
      ) : !available ? (
        <p className="text-sm text-gray-600">Máy chủ chưa bật gửi thông báo. Liên hệ quản trị viên.</p>
      ) : state === null ? (
        <p className="text-sm text-gray-400">Đang kiểm tra...</p>
      ) : state === 'denied' ? (
        <p className="text-sm text-gray-600">{DENIED_HINT}</p>
      ) : state === 'on' ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-gray-700 flex items-center gap-2 flex-1"><span className="dot bg-primary-500" /> Đang bật trên thiết bị này</p>
          <button type="button" disabled={busy} onClick={() => void test()} className="btn-secondary">Gửi thử</button>
          <button type="button" disabled={busy} onClick={() => void disable()} className="btn-secondary">Tắt</button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => void enable()} className="btn-primary">
          {busy ? 'Đang bật...' : 'Bật thông báo'}
        </button>
      )}

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
      {message && <p role="status" className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">{message}</p>}
    </section>
  );
}
