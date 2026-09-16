import React from 'react';
import { Construction } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <DashboardLayout
      leftPanel={
        <div className="p-4">
          <p className="text-gray-500">Menu đang được phát triển</p>
        </div>
      }
      centerContent={
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center text-gray-400">
            <Construction className="w-16 h-16 mx-auto mb-4 text-blue-300" />
            <h2 className="text-2xl font-bold text-gray-600">{title}</h2>
            <p className="mt-2">Trang này đang trong quá trình xây dựng...</p>
          </div>
        </div>
      }
      rightPanel={
        <div className="text-gray-400 text-sm italic">
          Các tính năng sẽ sớm được cập nhật.
        </div>
      }
    />
  );
}
