import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  selectedRowKey?: string | number | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalElements: number;
}

export function DataTable<T>({ 
  data, columns, keyExtractor, onRowClick, selectedRowKey,
  page, totalPages, onPageChange, totalElements 
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 text-xs text-gray-500 uppercase tracking-wider font-semibold">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`} style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row) => {
              const rowKey = keyExtractor(row);
              const isSelected = selectedRowKey === rowKey;
              return (
                <tr 
                  key={rowKey} 
                  className={`hover:bg-blue-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
        <div className="text-xs text-gray-500">
          Hiển thị <span className="font-medium">{(page - 1) * 10 + 1} - {Math.min(page * 10, totalElements)}</span> trong <span className="font-medium">{totalElements}</span> kết quả
        </div>
        <div className="flex items-center gap-1">
          <button 
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 rounded text-xs font-medium flex items-center justify-center
                    ${page === p ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button 
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
