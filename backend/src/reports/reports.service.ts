import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate high-level summary metrics across issues and projects.
   */
  async getSummary(projectId?: string) {
    const where = projectId ? { projectId } : {};

    const issues = await this.prisma.issue.findMany({
      where,
      select: {
        id: true,
        status: true,
        priority: true,
        supportLevel: true,
        isEscalated: true,
        responseSLAHours: true,
        resolutionSLAHours: true,
        firstRespondedAt: true,
        resolvedAt: true,
        createdDate: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
    });

    const now = Date.now();
    let totalBreached = 0;
    let totalAtRisk = 0;
    let totalWithinSLA = 0;
    let totalEscalated = 0;

    const statusCounts: Record<string, number> = {
      Open: 0,
      In_Progress: 0,
      Under_Review: 0,
      Resolved: 0,
      Closed: 0,
    };

    const priorityCounts: Record<string, number> = {
      Highest: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Lowest: 0,
    };

    const tierCounts: Record<string, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
    };

    const projectMap = new Map<string, { id: string; name: string; key: string; total: number; resolved: number }>();

    for (const issue of issues) {
      if (statusCounts[issue.status] !== undefined) {
        statusCounts[issue.status]++;
      }
      if (priorityCounts[issue.priority] !== undefined) {
        priorityCounts[issue.priority]++;
      }
      if (tierCounts[issue.supportLevel] !== undefined) {
        tierCounts[issue.supportLevel]++;
      }
      if (issue.isEscalated) {
        totalEscalated++;
      }

      // Track project stats
      if (issue.project) {
        const pId = issue.project.id;
        if (!projectMap.has(pId)) {
          projectMap.set(pId, {
            id: pId,
            name: issue.project.name,
            key: issue.project.key,
            total: 0,
            resolved: 0,
          });
        }
        const pStat = projectMap.get(pId)!;
        pStat.total++;
        if (issue.status === 'Resolved' || issue.status === 'Closed') {
          pStat.resolved++;
        }
      }

      // Calculate SLA status
      const createdMs = issue.createdDate.getTime();
      const slaHours = issue.resolutionSLAHours || 24;
      const slaLimitMs = slaHours * 3600000;

      if (issue.resolvedAt) {
        const durationMs = issue.resolvedAt.getTime() - createdMs;
        if (durationMs > slaLimitMs) {
          totalBreached++;
        } else {
          totalWithinSLA++;
        }
      } else {
        const elapsedMs = now - createdMs;
        if (elapsedMs > slaLimitMs) {
          totalBreached++;
        } else if (elapsedMs > slaLimitMs * 0.75) {
          totalAtRisk++;
        } else {
          totalWithinSLA++;
        }
      }
    }

    const totalIssues = issues.length;
    const complianceRate = totalIssues > 0
      ? Math.round(((totalIssues - totalBreached) / totalIssues) * 100)
      : 100;

    return {
      total: totalIssues,
      breached: totalBreached,
      atRisk: totalAtRisk,
      within: totalWithinSLA,
      escalated: totalEscalated,
      complianceRate,
      statusCounts,
      priorityCounts,
      tierCounts,
      projects: Array.from(projectMap.values()),
    };
  }

  /**
   * Detailed SLA performance metrics.
   */
  async getSlaMetrics(projectId?: string) {
    const summary = await this.getSummary(projectId);

    const where: any = {
      status: { in: ['Resolved', 'Closed'] },
      resolvedAt: { not: null },
    };
    if (projectId) {
      where.projectId = projectId;
    }

    const resolvedIssues = await this.prisma.issue.findMany({
      where,
      select: {
        createdDate: true,
        resolvedAt: true,
        firstRespondedAt: true,
      },
    });

    let avgResolutionHours = 0;
    let avgResponseHours = 0;

    if (resolvedIssues.length > 0) {
      let totalResMs = 0;
      let totalRespMs = 0;
      let respCount = 0;

      for (const iss of resolvedIssues) {
        if (iss.resolvedAt) {
          totalResMs += iss.resolvedAt.getTime() - iss.createdDate.getTime();
        }
        if (iss.firstRespondedAt) {
          totalRespMs += iss.firstRespondedAt.getTime() - iss.createdDate.getTime();
          respCount++;
        }
      }

      avgResolutionHours = Math.round((totalResMs / resolvedIssues.length / 3600000) * 10) / 10;
      avgResponseHours = respCount > 0
        ? Math.round((totalRespMs / respCount / 3600000) * 10) / 10
        : 0;
    }

    return {
      ...summary,
      avgResolutionHours,
      avgResponseHours,
      resolvedCount: resolvedIssues.length,
    };
  }
}
