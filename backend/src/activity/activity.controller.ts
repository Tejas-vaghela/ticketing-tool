import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { QueryActivityDto } from './dto/query-activity.dto';
import { ActivityFeedResponseDto } from './dto/activity-feed-response.dto';
import { ActivityEventResponseDto } from './dto/activity-event-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * ActivityController — REST API for audit ledger and workspace telemetry.
 *
 * Implements endpoints specified in ACTIVITY_MODULE.md:
 *   GET /api/activity                     — Global workspace activity feed with filters & pagination
 *   GET /api/activity/issues/:issueId     — Audit history for an issue
 *   GET /api/issues/:issueId/activity     — (Route alias matching existing API convention)
 *   GET /api/activity/projects/:projectId — Project cockpit activity feed
 *   GET /api/projects/:projectId/activity — (Route alias matching existing API convention)
 *
 * Note: Audit logs are strictly immutable append-only records.
 * No public POST, PUT, PATCH, or DELETE endpoints exist on this controller.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * GET /api/activity
   * Retrieve workspace activity feed with multi-attribute filtering & pagination.
   */
  @Get('activity')
  @HttpCode(HttpStatus.OK)
  async getFeed(@Query() query: QueryActivityDto): Promise<ActivityFeedResponseDto> {
    return this.activityService.getFeed(query);
  }

  /**
   * GET /api/activity/issues/:issueId AND GET /api/issues/:issueId/activity
   * Retrieve audit history for a single ticket.
   */
  @Get(['activity/issues/:issueId', 'issues/:issueId/activity'])
  @HttpCode(HttpStatus.OK)
  async getIssueActivity(
    @Param('issueId') issueId: string,
  ): Promise<ActivityEventResponseDto[]> {
    return this.activityService.findByIssue(issueId);
  }

  /**
   * GET /api/activity/projects/:projectId AND GET /api/projects/:projectId/activity
   * Retrieve activity feed for a project.
   */
  @Get(['activity/projects/:projectId', 'projects/:projectId/activity'])
  @HttpCode(HttpStatus.OK)
  async getProjectActivity(
    @Param('projectId') projectId: string,
  ): Promise<ActivityEventResponseDto[]> {
    return this.activityService.findByProject(projectId);
  }
}
