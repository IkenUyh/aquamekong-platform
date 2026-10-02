import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';

/** Hoạ tiết sóng mờ cho nửa trái (SVG thuần, không ảnh ngoài) */
function WavePattern() {
  return (
    <svg className="absolute inset-x-0 bottom-0 w-full h-64 opacity-[0.12]" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M0 ${60 + i * 34} C 100 ${30 + i * 34}, 200 ${90 + i * 34}, 300 ${60 + i * 34} S 500 ${30 + i * 34}, 600 ${60 + i * 34}`}
          stroke="#FFFFFF" strokeWidth="1.5" fill="none"
        />
      ))}
    </svg>
  );
}

/** Khung 2 cột của trang Đăng nhập / Đăng ký: nhận diện bên trái (≥ md), form bên phải */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { config } = useAuth();
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[var(--color-bg)]">
      <aside className="relative hidden md:flex flex-col justify-between overflow-hidden bg-primary p-10 lg:p-14 text-white">
        <Link to="/" aria-label="AquaMekong — Tổng quan" className="self-start">
          <Logo tone="light" />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Giám sát và dự báo xâm nhập mặn Đồng bằng sông Cửu Long</h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Số đo độ mặn, mực nước và lưu lượng từ các trạm quan trắc; dự báo 7–14 ngày và cảnh báo khi vượt ngưỡng.
          </p>
        </div>
        <p className="relative text-xs text-white/50">AquaMekong · Hệ thống quan trắc thủy văn</p>
        <WavePattern />
      </aside>

      <main className="min-w-0 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8">
            <Link to="/" aria-label="AquaMekong — Tổng quan"><Logo tone="dark" /></Link>
          </div>
          {children}
          {config?.publicRead && (
            <p className="mt-8 text-center text-sm">
              <Link to="/" className="text-gray-500 hover:text-primary hover:underline">Xem bản đồ độ mặn không cần đăng nhập</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

/** Đường kẻ "hoặc" giữa nút Google và form */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-400" role="separator">
      <span className="h-px flex-1 bg-gray-200" />
      hoặc
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}
