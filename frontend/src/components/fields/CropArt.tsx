import React from 'react';

/**
 * Minh hoạ phẳng cho từng loại cây / mục đích trong bảng crops, cùng một kiểu, vẽ tay (không lấy ảnh ngoài).
 * Mỗi hình nằm trên một ô nền riêng nên đọc được trên mọi nền. Dùng tông tự nhiên dịu: đỏ/vàng/xanh lá tươi dành
 * cho mức độ mặn (CLAUDE.md), không dùng ở đây.
 */
const TILE = '#EEF4F8';
const LEAF = '#5E7F5A';
const LEAF_LIGHT = '#8DAA7E';
const STRAW = '#C8A15A';
const STRAW_DARK = '#9C7A3C';

const art: Record<string, React.ReactNode> = {
  lua: (
    <g>
      {/* Bụi lúa: lá dài hai bên, hai bông trĩu hạt cong xuống */}
      <path d="M32 56c-1-10-6-20-16-26 8 1 14 6 17 14" fill={LEAF} />
      <path d="M32 56c1-10 6-20 16-26-8 1-14 6-17 14" fill={LEAF} />
      <path d="M31 56c-2-12-1-26 3-38 1 12 1 26-1 38z" fill={LEAF_LIGHT} />
      <path d="M33 24c-3-6-8-9-13-9" stroke={STRAW_DARK} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M33 22c4-5 9-7 14-6" stroke={STRAW_DARK} strokeWidth="2" strokeLinecap="round" fill="none" />
      {[[29, 18], [25, 16], [21, 15.5], [26, 20], [22, 19]].map(([x, y]) => (
        <ellipse key={`a${x}-${y}`} cx={x} cy={y} rx="2.6" ry="1.7" transform={`rotate(20 ${x} ${y})`} fill={STRAW} />
      ))}
      {[[37, 18], [41, 16.5], [45, 16], [40, 20], [44, 19.5]].map(([x, y]) => (
        <ellipse key={`b${x}-${y}`} cx={x} cy={y} rx="2.6" ry="1.7" transform={`rotate(-20 ${x} ${y})`} fill={STRAW} />
      ))}
    </g>
  ),
  sau_rieng: (
    <g>
      <path d="M32 12v6" stroke={STRAW_DARK} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="32" cy="36" rx="16" ry="18" fill="#8E9B52" />
      {[[22, 26], [32, 22], [42, 26], [18, 37], [28, 33], [36, 33], [46, 37], [22, 46], [32, 44], [42, 46], [32, 53]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 4}l3 4-3 4-3-4z`} fill="#6E7A3A" />
      ))}
    </g>
  ),
  buoi: (
    <g>
      <path d="M32 14c4-4 10-5 14-3-2 5-8 8-14 7" fill={LEAF} />
      <path d="M32 18v-5" stroke={STRAW_DARK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="37" r="18" fill="#A7BB72" />
      <circle cx="26" cy="31" r="5" fill="#C2D196" />
      {[[38, 42], [30, 46], [41, 33], [24, 40]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#87994F" />)}
    </g>
  ),
  xoai: (
    <g>
      <path d="M30 15c-6-5-14-4-17 0 5 3 12 4 17 0z" fill={LEAF} />
      <path d="M31 16v-4" stroke={STRAW_DARK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M31 17c11-2 20 8 18 21-2 11-12 16-21 12-8-4-11-13-8-22 2-6 5-10 11-11z" fill="#E0A04E" />
      <path d="M36 22c6 1 10 7 9 13" stroke="#F2C27E" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  ),
  dua: (
    <g>
      <path d="M32 26c-8-10-18-10-22-6 8 0 15 3 22 6z" fill={LEAF} />
      <path d="M32 26c8-10 18-10 22-6-8 0-15 3-22 6z" fill={LEAF} />
      <path d="M32 26c-2-10 2-16 6-18-1 7-3 12-6 18z" fill={LEAF_LIGHT} />
      <circle cx="25" cy="40" r="10" fill="#8A6A4A" />
      <circle cx="40" cy="42" r="11" fill="#6F8F55" />
      <circle cx="37" cy="38" r="3" fill="#89A86C" />
    </g>
  ),
  mia: (
    <g>
      {[22, 32, 42].map((x, i) => (
        <g key={x}>
          <rect x={x - 3} y={16 + i * 2} width="6" height={38 - i * 2} rx="3" fill={i === 1 ? '#8E6F86' : '#A88AA0'} />
          {[24, 34, 44].map((y) => <rect key={y} x={x - 3.5} y={y + i} width="7" height="2" rx="1" fill="#6E5268" />)}
        </g>
      ))}
      <path d="M32 18c-4-6-10-8-14-7 3 4 8 6 14 7z" fill={LEAF} />
      <path d="M42 20c4-6 10-8 14-7-3 4-8 6-14 7z" fill={LEAF_LIGHT} />
    </g>
  ),
  rau_mau: (
    <g>
      <path d="M32 54c-4-10-4-20 0-34 4 14 4 24 0 34z" fill="#DCE6CC" />
      <path d="M31 50c-10-2-17-12-16-26 8 4 14 13 16 26z" fill={LEAF} />
      <path d="M33 50c10-2 17-12 16-26-8 4-14 13-16 26z" fill={LEAF} />
      <path d="M32 46c-5-6-6-16-2-26 4 8 5 18 2 26z" fill={LEAF_LIGHT} />
    </g>
  ),
  tom: (
    <g transform="translate(32 32) scale(1.15) translate(-36 -30)">
      <path d="M44 20c6 4 8 13 4 20-5 9-17 12-25 6l5-4c5 3 12 1 15-4 3-5 2-11-2-14z" fill="#DE9878" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${44 - i * 4} ${26 + i * 4}l-4 2`} stroke="#B86F52" strokeWidth="2" strokeLinecap="round" />)}
      <path d="M23 46l-7 3 3-7-6 0 6-4" fill="#C9765A" />
      <circle cx="45" cy="24" r="1.6" fill="#3B2A22" />
      <path d="M47 21c5-6 9-10 12-11M48 23c6-2 9-2 11 0" stroke="#B86F52" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </g>
  ),
  nuoc_sinh_hoat: (
    <g>
      <path d="M32 12c8 11 14 19 14 27a14 14 0 0 1-28 0c0-8 6-16 14-27z" fill="#4A7EA3" />
      <path d="M25 40a7 7 0 0 0 7 7" stroke="#B6CDDD" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  ),
  _default: (
    <g>
      <path d="M32 54V32" stroke={LEAF} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 34c-10 0-16-6-16-14 10 0 16 6 16 14zM32 30c0-8 6-14 16-14 0 8-6 14-16 14z" fill={LEAF_LIGHT} />
    </g>
  ),
};

/** Mã cây → hình; tôm sú và tôm thẻ dùng chung hình tôm */
function artKey(code: string): string {
  if (code.startsWith('tom_')) return 'tom';
  return code in art ? code : '_default';
}

export function CropArt({ code, size = 56, className = '' }: { code: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill={TILE} />
      {art[artKey(code)]}
    </svg>
  );
}
