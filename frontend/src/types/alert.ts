export interface AlertDto {
  id: number;
  stationId: number;
  stationName: string;
  stationCode: string;
  alertType: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  message: string;
  thresholdValue: number;
  actualValue: number;
  isResolved: boolean;
  createdAt: string;
}
