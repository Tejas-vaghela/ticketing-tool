
import { EpicStatus } from '@prisma/client';

export const EPIC_STATUS_MAP: Record<string, EpicStatus> = {
  // Label variants with space
  'To Do': EpicStatus.To_Do,
  'In Progress': EpicStatus.In_Progress,
  'Done': EpicStatus.Done,

  // Prisma TypeScript enum identifiers
  'To_Do': EpicStatus.To_Do,
  'In_Progress': EpicStatus.In_Progress,

  // Lowercase & case-insensitive variants
  'to do': EpicStatus.To_Do,
  'to_do': EpicStatus.To_Do,
  'todo': EpicStatus.To_Do,
  'in progress': EpicStatus.In_Progress,
  'in_progress': EpicStatus.In_Progress,
  'inprogress': EpicStatus.In_Progress,
  'done': EpicStatus.Done,

  // Uppercase variants
  'TO DO': EpicStatus.To_Do,
  'TO_DO': EpicStatus.To_Do,
  'IN PROGRESS': EpicStatus.In_Progress,
  'IN_PROGRESS': EpicStatus.In_Progress,
  'DONE': EpicStatus.Done,
};

/**
 * Validates and normalizes an incoming status string into a valid Prisma EpicStatus enum value.
 * Returns null if the status cannot be mapped.
 */
export function normalizeEpicStatus(status: unknown): EpicStatus | null {
  if (typeof status !== 'string') return null;
  const trimmed = status.trim();
  if (!trimmed) return null;

  if (EPIC_STATUS_MAP[trimmed]) {
    return EPIC_STATUS_MAP[trimmed];
  }

  const lower = trimmed.toLowerCase();
  if (EPIC_STATUS_MAP[lower]) {
    return EPIC_STATUS_MAP[lower];
  }

  const upper = trimmed.toUpperCase();
  if (EPIC_STATUS_MAP[upper]) {
    return EPIC_STATUS_MAP[upper];
  }

  const enumValues = Object.values(EpicStatus) as string[];
  if (enumValues.includes(trimmed)) {
    return trimmed as EpicStatus;
  }

  return null;
}
