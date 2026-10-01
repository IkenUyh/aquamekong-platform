import React from 'react';

interface LogoProps {
  /** 'light' trên nền navy, 'dark' trên nền trắng */
  tone?: 'light' | 'dark';
  /** Ẩn chữ, chỉ giữ dấu logo */
  markOnly?: boolean;
  className?: string;
  /** Class cho phần chữ (vd. ẩn chữ theo breakpoint) */
  textClassName?: string;
}

/** Dấu logo: hai dải sóng (dòng sông và nước mặn) trong ô bo góc + chữ AquaMekong. */
export function Logo({ tone = 'light', markOnly = false, className = '', textClassName = '' }: LogoProps) {
  const ink = tone === 'light' ? '#FFFFFF' : '#0F3D5E';
  const accent = tone === 'light' ? '#7FB3D5' : '#4A7EA3';
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="shrink-0">
        <rect x="1" y="1" width="26" height="26" rx="6" stroke={ink} strokeWidth="1.5" />
        <path d="M5 11.5c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 4.3-2 5-1.4" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 17.5c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 4.3-2 5-1.4" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {!markOnly && (
        <span className={`font-semibold tracking-tight text-[17px] ${textClassName}`} style={{ color: ink }}>
          AquaMekong
        </span>
      )}
    </span>
  );
}
