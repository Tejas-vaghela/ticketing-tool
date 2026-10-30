import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SearchService } from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SearchResponseDto } from './dto/search-result.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /api/search
   * Execute global multi-entity or entity-filtered instant search across
   * Issues, Projects, Epics, Sprints, and Users.
   *
   * Query parameters:
   * - q (or search): Search keyword string (e.g., "payment", "INB-1002")
   * - type: Target entity ("all", "issues", "tickets", "projects", "epics", "sprints", "users")
   * - projectId: Scopes search to a specific project (ID or key)
   * - page: Page number for pagination (default: 1)
   * - limit: Maximum results per category or total (default: 10, max: 100)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async search(
    @Query() dto: SearchQueryDto,
    @CurrentUser() user?: any,
  ): Promise<SearchResponseDto> {
    const userId = user?.id || user?.sub;
    return this.searchService.search(dto, userId);
  }
}
