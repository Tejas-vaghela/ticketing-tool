import { IssueStatus } from '@prisma/client';

export const BOARD_STATUS_MAP: Record<string, IssueStatus> = {
  // Board column labels
  'To Do': IssueStatus.To_Do,
  'In Progress': IssueStatus.In_Progress,
  'In Review': IssueStatus.In_Review,
  'Testing': IssueStatus.Testing,
  'Testing / QA': IssueStatus.Testing,
  'Testing/QA': IssueStatus.Testing,
  'Resolved': IssueStatus.Resolved,
  'Closed': IssueStatus.Closed,
  'Open': IssueStatus.Open,
  'Blocked': IssueStatus.Blocked,

  // Prisma TypeScript enum identifiers
  'To_Do': IssueStatus.To_Do,
  'In_Progress': IssueStatus.In_Progress,
  'In_Review': IssueStatus.In_Review,

  // Lowercase & case-insensitive variants
  'to do': IssueStatus.To_Do,
  'to_do': IssueStatus.To_Do,
  'todo': IssueStatus.To_Do,
  'in progress': IssueStatus.In_Progress,
  'in_progress': IssueStatus.In_Progress,
  'in review': IssueStatus.In_Review,
  'in_review': IssueStatus.In_Review,
  'testing': IssueStatus.Testing,
  'resolved': IssueStatus.Resolved,
  'closed': IssueStatus.Closed,
  'open': IssueStatus.Open,
  'blocked': IssueStatus.Blocked,

  // Uppercase variants
  'TO DO': IssueStatus.To_Do,
  'TO_DO': IssueStatus.To_Do,
  'IN PROGRESS': IssueStatus.In_Progress,
  'IN_PROGRESS': IssueStatus.In_Progress,
  'IN REVIEW': IssueStatus.In_Review,
  'IN_REVIEW': IssueStatus.In_Review,
  'TESTING': IssueStatus.Testing,
  'RESOLVED': IssueStatus.Resolved,
  'CLOSED': IssueStatus.Closed,
  'OPEN': IssueStatus.Open,
  'BLOCKED': IssueStatus.Blocked,
};

/**
 * Validates and normalizes an incoming status string (board label, enum key, or variant)
 * into a valid Prisma IssueStatus enum value.
 * Returns null if the status cannot be mapped.
 */
export function normalizeIssueStatus(status: unknown): IssueStatus | null {
  if (typeof status !== 'string') return null;
  const trimmed = status.trim();
  if (!trimmed) return null;

  if (BOARD_STATUS_MAP[trimmed]) {
    return BOARD_STATUS_MAP[trimmed];
  }

  const lower = trimmed.toLowerCase();
  if (BOARD_STATUS_MAP[lower]) {
    return BOARD_STATUS_MAP[lower];
  }

  const upper = trimmed.toUpperCase();
  if (BOARD_STATUS_MAP[upper]) {
    return BOARD_STATUS_MAP[upper];
  }

  const enumValues = Object.values(IssueStatus) as string[];
  if (enumValues.includes(trimmed)) {
    return trimmed as IssueStatus;
  }

  return null;
}
