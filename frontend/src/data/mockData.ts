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
    status: "ACTIVE",
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
    metricType: "SALINITY",
    alertLevel: "CRITICAL",
    message: "Độ mặn vượt mức 4.5‰, nguy cơ xâm nhập mặn nghiêm trọng.",
    measuredValue: 4.8,
    thresholdValue: 4.0,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    stationId: 5,
    stationName: "Trạm Ba Lai",
    metricType: "WATER_LEVEL",
    alertLevel: "WARNING",
    message: "Mực nước thấp hơn trung bình 15%, cần theo dõi lưu lượng.",
    measuredValue: 1.2,
    thresholdValue: 1.5,
    isActive: true,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 3,
    stationId: 12,
    stationName: "Trạm Trần Đề",
    metricType: "SALINITY",
    alertLevel: "WARNING",
    message: "Dự báo xâm nhập mặn có xu hướng tăng trong 3 ngày tới.",
    measuredValue: 3.1,
    thresholdValue: 3.5,
    isActive: false,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

export const MOCK_TREND_DATA = [
  { month: 'T1', salinity: 1.2, waterLevel: 2.1 },
  { month: 'T2', salinity: 2.5, waterLevel: 1.8 },
  { month: 'T3', salinity: 3.8, waterLevel: 1.5 },
  { month: 'T4', salinity: 4.5, waterLevel: 1.2 },
  { month: 'T5', salinity: 2.1, waterLevel: 1.9 },
  { month: 'T6', salinity: 0.8, waterLevel: 2.5 },
];

export const MOCK_TOP_STATIONS = [
  { name: 'Trạm Vàm Cỏ Đông', value: 4.8 },
  { name: 'Trạm Ba Lai', value: 4.2 },
  { name: 'Trạm Trần Đề', value: 3.9 },
  { name: 'Trạm Cổ Chiên', value: 3.5 },
  { name: 'Trạm Hàm Luông', value: 3.1 },
];

export const generateMockForecasts = (stationId: number): SalinityForecast[] => {
  const today = new Date();
  return Array.from({length: 7}).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return {
      id: i,
      stationId,
      forecastDate: d.toISOString(),
      predictedSalinity: Math.round((3.5 + Math.random() * 2) * 10) / 10,
      confidenceScore: 85 - i * 2,
      modelName: "AI_LSTM_V1",
      createdAt: today.toISOString()
    };
  });
};
