import { describe, expect, it } from 'vitest';
import { toAlertDto } from './alertApi';
import type { Alert } from '../types';

const backendAlert: Alert = {
  id: 3,
  stationId: 1,
  stationName: 'Trạm Cần Thơ',
  province: 'Cần Thơ',
  ruleId: 7,
  metricType: 'salinity',
  value: 5.234,
  threshold: 4,
  severity: 'HIGH',
  status: 'ACTIVE',
  triggeredAt: '2026-10-01T03:00:00Z',
};

describe('toAlertDto', () => {
  it('maps backend fields to the fields the UI renders', () => {
    const dto = toAlertDto(backendAlert);
    expect(dto.alertLevel).toBe('CRITICAL');
    expect(dto.measuredValue).toBe(5.234);
    expect(dto.thresholdValue).toBe(4);
    expect(dto.isActive).toBe(true);
    expect(dto.province).toBe('Cần Thơ');
    expect(dto.createdAt).toBe('2026-10-01T03:00:00Z');
    expect(dto.message).toBe('Độ mặn 5,23‰ vượt ngưỡng 4‰');
  });

  it('maps severities to UI levels', () => {
    expect(toAlertDto({ ...backendAlert, severity: 'MEDIUM' }).alertLevel).toBe('WARNING');
    expect(toAlertDto({ ...backendAlert, severity: 'LOW' }).alertLevel).toBe('INFO');
  });

  it('marks resolved alerts as inactive', () => {
    const dto = toAlertDto({ ...backendAlert, status: 'RESOLVED' });
    expect(dto.isActive).toBe(false);
    expect(dto.isResolved).toBe(true);
  });
});
