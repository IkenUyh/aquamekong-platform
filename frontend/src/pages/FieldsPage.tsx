import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';
import { FieldCard } from '../components/fields/FieldCard';
import { FieldWizard } from '../components/fields/FieldWizard';
import { apiErrorMessage } from '../api/client';
import type { FieldRequest } from '../api/fieldApi';
import { useCrops } from '../hooks/useCrops';
import { useFields, useRemoveField, useSaveField } from '../hooks/useFields';
import { useStationsList } from '../hooks/useStations';
import { useWatches } from '../hooks/useWatches';
import { EMPTY_FIELD_FORM, formFromField } from '../utils/fieldForm';

/**
 * "Ruộng của tôi": hồ sơ các ruộng/ao của tài khoản. Chưa có ruộng thì mở ngay form khai theo bước; có rồi thì mỗi
 * ruộng một thẻ với hình cây, thanh tiến độ giai đoạn, trạm gần nhất và ngưỡng mặn của giai đoạn hiện tại.
 */
export function FieldsPage() {
  const { data: fields = [], isLoading } = useFields();
  const { data: crops = [] } = useCrops();
  const { data: stations = [] } = useStationsList();
  const { data: watches = [] } = useWatches();
  const save = useSaveField();
  const remove = useRemoveField();

  /** null: không mở form; 'new': khai ruộng mới; số: sửa ruộng đó */
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Chưa có ruộng nào thì mở sẵn form, không bắt bấm thêm nút
  const wizardOpen = editing != null || (!isLoading && fields.length === 0);
  const editingField = typeof editing === 'number' ? fields.find((f) => f.id === editing) : undefined;

  const onSave = async (req: FieldRequest) => {
    await save.mutateAsync({ id: editingField ? editingField.id : null, req });
    setEditing(null);
  };

  const onRemove = async (id: number, name: string) => {
    if (!window.confirm(`Xoá hồ sơ "${name}"? App sẽ bỏ theo dõi trạm của ruộng này.`)) return;
    setError(null);
    try {
      await remove.mutateAsync(id);
      if (editing === id) setEditing(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không xoá được, vui lòng thử lại.'));
    }
  };

  return (
    <div className="flex flex-col h-dvh w-screen bg-[var(--color-bg)]">
      <Navbar />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Ruộng của tôi</h1>
              <p className="mt-1 text-sm text-gray-500">
                Khai một lần cho mỗi ruộng hoặc ao. App tự theo dõi trạm gần ruộng với ngưỡng mặn theo cây và giai đoạn hiện tại.
              </p>
            </div>
            {!wizardOpen && fields.length > 0 && (
              <button type="button" className="btn-primary" onClick={() => setEditing('new')}>Khai ruộng mới</button>
            )}
          </div>

          {wizardOpen && (
            <FieldWizard
              // Đổi ruộng đang sửa thì dựng lại form với dữ liệu ruộng đó
              key={editing ?? 'first'}
              crops={crops}
              stations={stations}
              initial={editingField ? formFromField(editingField) : EMPTY_FIELD_FORM}
              isNew={!editingField}
              saving={save.isPending}
              onSave={onSave}
              onCancel={fields.length > 0 ? () => setEditing(null) : undefined}
            />
          )}

          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          {isLoading ? (
            <p className="text-sm text-gray-400">Đang tải...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((f) => (
                <FieldCard key={f.id} field={f} crop={crops.find((c) => c.code === f.cropCode)}
                  watch={watches.find((w) => w.fieldProfileId === f.id)} busy={remove.isPending}
                  onEdit={() => setEditing(f.id)} onRemove={() => void onRemove(f.id, f.name)} />
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
