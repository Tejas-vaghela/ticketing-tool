import { describe, it, expect } from 'vitest';
import {
  hasRoleAccessToPage,
  getPageDefinition,
  getAllowedRolesForPage,
  getAllowedPagesForRole,
  ALL_ROLES,
  PAGE_DEFINITIONS,
} from './rbac';

describe('RBAC Service', () => {
  describe('PAGE_DEFINITIONS and ALL_ROLES', () => {
    it('should have predefined roles', () => {
      expect(ALL_ROLES).toContain('Admin');
      expect(ALL_ROLES).toContain('Engineer');
      expect(ALL_ROLES).toContain('Viewer');
      expect(ALL_ROLES.length).toBeGreaterThanOrEqual(8);
    });

    it('should have valid page definitions', () => {
      expect(PAGE_DEFINITIONS.length).toBeGreaterThan(0);
      const dashboard = PAGE_DEFINITIONS.find((p) => p.id === 'dashboard');
      expect(dashboard).toBeDefined();
      expect(dashboard?.path).toBe('/');
    });
  });

  describe('hasRoleAccessToPage', () => {
    it('should return false if role is undefined or empty', () => {
      expect(hasRoleAccessToPage(undefined, 'dashboard')).toBe(false);
      expect(hasRoleAccessToPage('', 'dashboard')).toBe(false);
    });

    it('should always grant Admin access to any page', () => {
      expect(hasRoleAccessToPage('Admin', 'dashboard')).toBe(true);
      expect(hasRoleAccessToPage('Admin', 'admin')).toBe(true);
      expect(hasRoleAccessToPage('Admin', 'settings')).toBe(true);
      expect(hasRoleAccessToPage('Admin', 'reports')).toBe(true);
    });

    it('should restrict unauthorized roles from protected pages', () => {
      // Viewer should not have access to admin panel
      expect(hasRoleAccessToPage('Viewer', 'admin')).toBe(false);
    });

    it('should allow authorized roles for standard pages', () => {
      expect(hasRoleAccessToPage('Engineer', 'issues')).toBe(true);
      expect(hasRoleAccessToPage('Support Agent', 'support')).toBe(true);
    });
  });

  describe('getPageDefinition', () => {
    it('should return correct definition for existing page', () => {
      const def = getPageDefinition('board');
      expect(def).toBeDefined();
      expect(def?.label).toBe('Kanban Board');
    });

    it('should return undefined for invalid page id', () => {
      // @ts-expect-error test invalid page
      const def = getPageDefinition('non_existent_page');
      expect(def).toBeUndefined();
    });
  });

  describe('getAllowedRolesForPage', () => {
    it('should return allowed roles for a given page', () => {
      const roles = getAllowedRolesForPage('admin');
      expect(roles).toContain('Admin');
      expect(roles).not.toContain('Viewer');
    });
  });

  describe('getAllowedPagesForRole', () => {
    it('should return all pages for Admin', () => {
      const pages = getAllowedPagesForRole('Admin');
      expect(pages.length).toBe(PAGE_DEFINITIONS.length);
    });

    it('should return a subset of pages for Viewer', () => {
      const pages = getAllowedPagesForRole('Viewer');
      expect(pages).toContain('dashboard');
      expect(pages).not.toContain('admin');
      expect(pages.length).toBeLessThan(PAGE_DEFINITIONS.length);
    });
  });
});

