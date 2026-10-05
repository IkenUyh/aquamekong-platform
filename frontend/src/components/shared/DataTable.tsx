import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  /** Toàn bộ dữ liệu — bảng tự chia trang */
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  selectedRowKey?: string | number | null;
  pageSize?: number;
  emptyText?: string;
}

const MAX_PAGE_BUTTONS = 5;

const alignClass = (align?: Column<unknown>['align']) =>
  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

export function DataTable<T>({
  data, columns, keyExtractor, onRowClick, selectedRowKey, pageSize = 10, emptyText = 'Không có dữ liệu',
}: DataTableProps<T>) {
  const [requestedPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  // Dữ liệu thay đổi (lọc, refetch) có thể làm trang hiện tại không còn tồn tại
  const page = Math.min(requestedPage, totalPages);
  const rows = data.slice((page - 1) * pageSize, page * pageSize);

  // Cửa sổ tối đa 5 nút trang quanh trang hiện tại
  const firstButton = Math.max(1, Math.min(page - Math.floor(MAX_PAGE_BUTTONS / 2), totalPages - MAX_PAGE_BUTTONS + 1));
  const pageButtons = Array.from({ length: Math.min(MAX_PAGE_BUTTONS, totalPages) }, (_, i) => firstButton + i);

  return (
    <div className="flex flex-col h-full card overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* < md: giữ nguyên độ rộng cột và cuộn ngang thay vì bóp chữ xuống từng dòng */}
        <table className="w-full min-w-max md:min-w-0 text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 text-xs text-gray-500 font-semibold">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 whitespace-nowrap ${alignClass(col.align)}`} style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const rowKey = keyExtractor(row);
              const isSelected = selectedRowKey === rowKey;
              return (
                <tr
                  key={rowKey}
                  className={`hover:bg-primary-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary-50' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 whitespace-nowrap md:whitespace-normal ${alignClass(col.align)}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
        <div className="text-xs text-gray-500">
          {data.length === 0 ? (
            '0 kết quả'
          ) : (
            <>
              Hiển thị <span className="font-medium">{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, data.length)}</span> trong{' '}
              <span className="font-medium">{data.length}</span> kết quả
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Trang trước"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex gap-1">
            {pageButtons.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                aria-current={page === p ? 'page' : undefined}
                className={`w-7 h-7 rounded text-xs font-medium flex items-center justify-center
                  ${page === p ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            aria-label="Trang sau"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
