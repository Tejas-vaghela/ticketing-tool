// jest globals
import { IssueStatus } from '@prisma/client';
import { normalizeIssueStatus } from '../../backend/src/issues/status-mapper';

describe('status-mapper', () => {
  it('should correctly map all standard Kanban board column labels to Prisma IssueStatus enums', () => {
    expect(normalizeIssueStatus('To Do')).toBe(IssueStatus.To_Do);
    expect(normalizeIssueStatus('In Progress')).toBe(IssueStatus.In_Progress);
    expect(normalizeIssueStatus('In Review')).toBe(IssueStatus.In_Review);
    expect(normalizeIssueStatus('Testing')).toBe(IssueStatus.Testing);
    expect(normalizeIssueStatus('Testing / QA')).toBe(IssueStatus.Testing);
    expect(normalizeIssueStatus('Resolved')).toBe(IssueStatus.Resolved);
    expect(normalizeIssueStatus('Closed')).toBe(IssueStatus.Closed);
    expect(normalizeIssueStatus('Open')).toBe(IssueStatus.Open);
    expect(normalizeIssueStatus('Blocked')).toBe(IssueStatus.Blocked);
  });

  it('should accept direct Prisma enum values', () => {
    expect(normalizeIssueStatus(IssueStatus.To_Do)).toBe(IssueStatus.To_Do);
    expect(normalizeIssueStatus(IssueStatus.In_Progress)).toBe(IssueStatus.In_Progress);
    expect(normalizeIssueStatus(IssueStatus.In_Review)).toBe(IssueStatus.In_Review);
    expect(normalizeIssueStatus(IssueStatus.Testing)).toBe(IssueStatus.Testing);
    expect(normalizeIssueStatus(IssueStatus.Resolved)).toBe(IssueStatus.Resolved);
    expect(normalizeIssueStatus(IssueStatus.Closed)).toBe(IssueStatus.Closed);
  });

  it('should handle case-insensitive and trimmed variants', () => {
    expect(normalizeIssueStatus('  in progress  ')).toBe(IssueStatus.In_Progress);
    expect(normalizeIssueStatus('to do')).toBe(IssueStatus.To_Do);
    expect(normalizeIssueStatus('IN_PROGRESS')).toBe(IssueStatus.In_Progress);
    expect(normalizeIssueStatus('resolved')).toBe(IssueStatus.Resolved);
    expect(normalizeIssueStatus('closed')).toBe(IssueStatus.Closed);
  });

  it('should return null for invalid or empty status inputs', () => {
    expect(normalizeIssueStatus('')).toBeNull();
    expect(normalizeIssueStatus('   ')).toBeNull();
    expect(normalizeIssueStatus('InvalidStatus')).toBeNull();
    expect(normalizeIssueStatus(null)).toBeNull();
    expect(normalizeIssueStatus(undefined)).toBeNull();
    expect(normalizeIssueStatus(123)).toBeNull();
  });
});
