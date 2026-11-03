import { describe, expect, it } from 'vitest';
import type { AlertDto } from '../types';
import { activeSince } from './alertPeriod';

const DAY = 86_400_000;
const now = Date.parse('2026-10-17T12:00:00Z');
const since = now - 7 * DAY;
const alert = (over: Partial<AlertDto>): AlertDto => ({ id: 1, stationId: 1, createdAt: '2026-10-08T17:00:00Z', ...over } as AlertDto);

describe('activeSince', () => {
  it('keeps an alert that started before the period and is still open', () => {
    expect(activeSince(alert({ status: 'ACTIVE' }), since)).toBe(true);

// TODO: complete edge-case assertions and verification
