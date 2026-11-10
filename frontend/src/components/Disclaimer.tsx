import React from 'react';

/**
 * Hệ thống chỉ hỗ trợ ra quyết định (Charter, Out of Scope): dự báo, mức "có thể lên tới" và khuyến nghị là ước
 * tính của mô hình. Đặt ở mọi chỗ đưa ra dự báo, cảnh báo hoặc khuyến nghị, kể cả trong app (cùng bản build).
 */
export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p role="note" className={`text-xs text-gray-500 ${className}`}>
      Dữ liệu chỉ mang tính chất tham khảo. Dự báo, mức &quot;có thể lên tới&quot; và khuyến nghị là ước tính của mô
      hình AquaMekong, không phải bản tin chính thức của cơ quan quản lý. Hãy đối chiếu với thông báo của địa phương
      trước khi lấy hoặc trữ nước.
    </p>
  );
}
