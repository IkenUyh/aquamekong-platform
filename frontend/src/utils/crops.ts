/**
 * Ngưỡng độ mặn gợi ý cho nước tưới theo loại cây (‰). Người dùng sửa được ngưỡng; đây chỉ là điểm bắt đầu,
 * theo khuyến cáo phổ biến ở ĐBSCL: sầu riêng rất nhạy mặn, cây ăn trái chịu khoảng 1‰, lúa và rau màu khoảng 2‰.
 */
export const CROP_PRESETS: { crop: string; threshold: number }[] = [
  { crop: 'Sầu riêng', threshold: 0.5 },
  { crop: 'Cây ăn trái', threshold: 1 },
  { crop: 'Lúa', threshold: 2 },
  { crop: 'Rau màu', threshold: 2 },
];

/** Giá trị của lựa chọn "Tự đặt ngưỡng" trong ô chọn loại cây */
export const CUSTOM_CROP = '';
