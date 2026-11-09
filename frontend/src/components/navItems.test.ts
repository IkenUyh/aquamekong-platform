import { describe, expect, it } from 'vitest';
import { topRoleLabel } from './navItems';

describe('topRoleLabel', () => {
  it('shows only the highest role of an account with several', () => {
    expect(topRoleLabel(['ROLE_USER', 'ROLE_ADMIN'])).toBe('Quản trị');
    expect(topRoleLabel(['ROLE_USER', 'ROLE_OPERATOR'])).toBe('Vận hành');
    expect(topRoleLabel(['ROLE_USER'])).toBe('Người dùng');
  });

  it('has no label without roles', () => {
    expect(topRoleLabel(undefined)).toBeUndefined();
    expect(topRoleLabel([])).toBeUndefined();
  });
});
