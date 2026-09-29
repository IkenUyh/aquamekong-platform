export interface AlertDto {
  id: number;
  stationId: number;
  stationName?: string;
  stationCode?: string;
  metricType?: string;
  alertType?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'WARNING' | 'INFO';
  alertLevel?: 'CRITICAL' | 'WARNING' | 'SAFE' | 'INFO';
  message?: string;
  thresholdValue?: number;
  measuredValue?: number;
  actualValue?: number;
  isActive?: boolean;
  isResolved?: boolean;
  createdAt: string;
}
