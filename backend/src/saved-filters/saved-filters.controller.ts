import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SavedFiltersService } from './saved-filters.service';
import { CreateFilterDto } from './dto/create-filter.dto';
import { UpdateFilterDto } from './dto/update-filter.dto';
import { QuerySavedFiltersDto } from './dto/query-saved-filters.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SavedFilter } from '@prisma/client';

@Controller('saved-filters')
@UseGuards(JwtAuthGuard)
export class SavedFiltersController {
  constructor(private readonly savedFiltersService: SavedFiltersService) {}

  /**
   * GET /api/saved-filters — List saved filters for authenticated user
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @CurrentUser() user: { id?: string; sub?: string },
    @Query() query: QuerySavedFiltersDto,
  ): Promise<SavedFilter[]> {
    const userId = user.id || user.sub!;
    return this.savedFiltersService.findAll(userId, query);
  }

  /**
   * GET /api/saved-filters/:id — Get a single saved filter
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id?: string; sub?: string },
  ): Promise<SavedFilter> {
    const userId = user.id || user.sub!;
    return this.savedFiltersService.findOne(id, userId);
  }

  /**
   * POST /api/saved-filters — Create a custom filter preset
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateFilterDto,
    @CurrentUser() user: { id?: string; sub?: string },
  ): Promise<SavedFilter> {
    const userId = user.id || user.sub!;
    return this.savedFiltersService.create(userId, dto);
  }

  /**
   * PATCH /api/saved-filters/:id — Update filter preset
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFilterDto,
    @CurrentUser() user: { id?: string; sub?: string },
  ): Promise<SavedFilter> {
    const userId = user.id || user.sub!;
    return this.savedFiltersService.update(id, userId, dto);
  }

  /**
   * DELETE /api/saved-filters/:id — Delete filter preset
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id?: string; sub?: string },
  ): Promise<{ success: boolean }> {
    const userId = user.id || user.sub!;
    return this.savedFiltersService.remove(id, userId);
  }
}
