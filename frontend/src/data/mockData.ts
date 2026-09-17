import type { Station, WaterMetric, SalinityForecast, AlertDto } from '../types';

export const MOCK_STATIONS_LIST = Array.from({ length: 25 }).map((_, i) => {
  const isHigh = i < 5;
  const isMed = i >= 5 && i < 15;
  const sal = isHigh ? 4.5 + Math.random() * 2 : isMed ? 1.5 + Math.random() * 2 : Math.random();
  const provinces = ["Tiền Giang", "Bến Tre", "Trà Vinh", "Sóc Trăng", "Cần Thơ", "An Giang"];
  const rivers = ["Sông Tiền", "Sông Hậu", "Sông Cổ Chiên", "Sông Hàm Luông"];
  
  return {
    id: i + 1,
    name: `Trạm Quan Trắc ${i + 1}`,
    code: `ST${(i + 1).toString().padStart(2, '0')}`,
    latitude: 9.5 + Math.random(),
    longitude: 105.5 + Math.random(),
    province: provinces[i % provinces.length],
    riverName: rivers[i % rivers.length],
    latestSalinity: parseFloat(sal.toFixed(1)),
    latestWaterLevel: parseFloat((1 + Math.random()).toFixed(2)),
    latestFlowRate: Math.floor(1000 + Math.random() * 3000),
    salinityLevel: isHigh ? "CRITICAL" : isMed ? "WARNING" : "SAFE",
    status: "Hoạt động",
  } as Station;
});

export const MOCK_RECOMMENDATIONS = [
  { type: 'IRRIGATION', priority: 'HIGH', message: 'Hạn chế lấy nước ngọt tại trạm Vàm Cỏ (Độ mặn 4.8‰)', icon: '🚫' },
  { type: 'DAM_CHECK', priority: 'MEDIUM', message: 'Khuyến nghị kiểm tra hệ thống cống ngăn mặn ở hạ lưu.', icon: '🔧' },
  { type: 'WATER_SAVING', priority: 'LOW', message: 'Lên lịch tưới tiêu tiết kiệm cho vùng chuyên canh.', icon: '💧' }
];

export const MOCK_ALERTS: AlertDto[] = [
  {
    id: 1,
    stationId: 1,
    stationName: "Trạm Vàm Cỏ",
    stationCode: "ST01",
    alertType: "SALINITY_THRESHOLD",
    severity: "CRITICAL",
    message: "Độ mặn vượt mức 4.5‰, nguy cơ xâm nhập mặn nghiêm trọng.",
    actualValue: 4.8,
    thresholdValue: 4.0,
    isResolved: false,
    province: "Tiền Giang",
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    stationId: 5,
    stationName: "Trạm Ba Lai",
    stationCode: "ST05",
    alertType: "WATER_LEVEL",
    severity: "WARNING",
    message: "Mực nước thấp hơn trung bình 15%, cần theo dõi lưu lượng.",
    actualValue: 1.2,
    thresholdValue: 1.5,
    isResolved: false,
    province: "Bến Tre",
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 3,
    stationId: 12,
    stationName: "Trạm Trần Đề",
    stationCode: "ST12",
    alertType: "SALINITY_FORECAST",
    severity: "WARNING",
    message: "Dự báo xâm nhập mặn có xu hướng tăng trong 3 ngày tới.",
    actualValue: 3.1,
    thresholdValue: 3.5,
    isResolved: true,
    province: "Sóc Trăng",
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

export const MOCK_TREND_DATA = [
  { date: 'T1', current: 1.2, prev: 2.1 },
  { date: 'T2', current: 2.5, prev: 1.8 },
  { date: 'T3', current: 3.8, prev: 1.5 },
  { date: 'T4', current: 4.5, prev: 1.2 },
  { date: 'T5', current: 2.1, prev: 1.9 },
  { date: 'T6', current: 0.8, prev: 2.5 },
];

export const MOCK_TOP_STATIONS = [
  { rank: 1, name: 'Trạm Vàm Cỏ Đông', province: 'Tiền Giang', salinity: 4.8, diff: '+1.2%' },
  { rank: 2, name: 'Trạm Ba Lai', province: 'Bến Tre', salinity: 4.2, diff: '+0.5%' },
  { rank: 3, name: 'Trạm Trần Đề', province: 'Sóc Trăng', salinity: 3.9, diff: '+0.2%' },
  { rank: 4, name: 'Trạm Cổ Chiên', province: 'Trà Vinh', salinity: 3.5, diff: '-0.1%' },
  { rank: 5, name: 'Trạm Hàm Luông', province: 'Bến Tre', salinity: 3.1, diff: '-0.3%' },
];

export const generateMockForecasts = (stationId: number): SalinityForecast[] => {
  const today = new Date();
  return Array.from({length: 7}).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const predicted = Math.round((3.5 + Math.random() * 2) * 10) / 10;
    return {
      id: i,
      stationId,
      forecastDate: d.toISOString(),
      predictedSalinity: predicted,
      confidenceLevel: 85 - i * 2,
      lowerBound: predicted - 0.5,
      upperBound: predicted + 0.5,
      modelVersion: "AI_LSTM_V1"
    };
  });
};
