import React from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Construction } from 'lucide-react';

export function OverviewPage() {
  return (
    <DashboardLayout
      leftPanel={
        <div className="p-4">
          <p className="text-gray-500">Trang tổng quan</p>
        </div>
      }
      centerContent={
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center text-gray-400">
            <Construction className="w-16 h-16 mx-auto mb-4 text-blue-300" />
            <h2 className="text-2xl font-bold text-gray-600">Tổng quan</h2>
            <p className="mt-2">Dashboard tổng quan đang được phát triển...</p>
          </div>
        </div>
      }
      rightPanel={
        <div className="text-gray-400 text-sm italic">
          Sẽ hiển thị các widget tổng hợp.
        </div>
      }
    />
  );
}
