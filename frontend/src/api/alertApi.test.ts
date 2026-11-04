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

// TODO: complete edge-case assertions and verification
