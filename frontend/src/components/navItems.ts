import {
  Bell, History, LayoutDashboard, Map as MapIcon, RadioTower, Settings, TrendingUp, FileBarChart, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  /** Nhãn ngắn cho lg–xl (7 tab không xuống dòng) và thanh tab dưới trên điện thoại */
  short: string;
  path: string;
  icon: LucideIcon;
  roles?: string[];
  /** Có tab riêng ở thanh dưới trên điện thoại, còn lại nằm trong "Thêm" */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan',      short: 'Tổng quan', path: '/',         icon: LayoutDashboard, primary: true },
  { label: 'Bản đồ độ mặn',  short: 'Bản đồ',    path: '/map',      icon: MapIcon,         primary: true },
  { label: 'Trạm quan trắc', short: 'Trạm',      path: '/stations', icon: RadioTower },
  { label: 'Dự báo',         short: 'Dự báo',    path: '/forecast', icon: TrendingUp,      primary: true },
  { label: 'Cảnh báo',       short: 'Cảnh báo',  path: '/alerts',   icon: Bell,            primary: true },
  { label: 'Báo cáo',        short: 'Báo cáo',   path: '/reports',  icon: FileBarChart },
  { label: 'Phát lại',       short: 'Phát lại',  path: '/replay',   icon: History },
  { label: 'Quản trị',       short: 'Quản trị',  path: '/admin',    icon: Settings, roles: ['ROLE_OPERATOR', 'ROLE_ADMIN'] },
];

/** 2 chữ cái đầu của tên, dùng làm avatar */
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() ?? '').join('');

export const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: 'Quản trị',
  ROLE_OPERATOR: 'Vận hành',
  ROLE_USER: 'Người dùng',
};
