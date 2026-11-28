import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, topRoleLabel, visibleNavItems } from './navItems';

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

describe('visibleNavItems', () => {
  const staff = (...roles: string[]) => roles.includes('ROLE_ADMIN');
  const guest = () => false;
  const paths = (farmer: boolean, hasRole: (...r: string[]) => boolean) =>
    visibleNavItems(NAV_ITEMS, hasRole, farmer).map((i) => i.path);

  it('shows every page the account may open when farmer mode is off', () => {
    expect(paths(false, staff)).toEqual(expect.arrayContaining(['/reports', '/replay', '/admin']));
    expect(paths(false, guest)).not.toContain('/admin');
  });

  it('hides replay, reports and admin in farmer mode, even for staff', () => {
    const shown = paths(true, staff);
    expect(shown).not.toContain('/reports');
    expect(shown).not.toContain('/replay');
    expect(shown).not.toContain('/admin');
    expect(shown).toEqual(expect.arrayContaining(['/', '/fields', '/map', '/forecast', '/alerts']));
  });
});
