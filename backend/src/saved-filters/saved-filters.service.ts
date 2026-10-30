import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFilterDto } from './dto/create-filter.dto';
import { UpdateFilterDto } from './dto/update-filter.dto';
import { QuerySavedFiltersDto } from './dto/query-saved-filters.dto';
import { SavedFilter, Prisma } from '@prisma/client';

@Injectable()
export class SavedFiltersService {
  private readonly logger = new Logger(SavedFiltersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all saved filters for the current user
   */
  async findAll(userId: string, query?: QuerySavedFiltersDto): Promise<SavedFilter[]> {
    const where: Prisma.SavedFilterWhereInput = {
      userId,
    };

    if (query?.search) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    return this.prisma.savedFilter.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Find a single saved filter by ID, ensuring ownership
   */
  async findOne(id: string, userId: string): Promise<SavedFilter> {
    const filter = await this.prisma.savedFilter.findUnique({
      where: { id },
    });

    if (!filter) {
      throw new NotFoundException(`Saved filter with ID "${id}" not found.`);
    }

    if (filter.userId && filter.userId !== userId) {
      throw new ForbiddenException('You do not have permission to access this saved filter.');
    }

    return filter;
  }

  /**
   * Create a new saved filter preset for the user
   */
  async create(userId: string, dto: CreateFilterDto): Promise<SavedFilter> {
    return this.prisma.savedFilter.create({
      data: {
        userId,
        name: dto.name.trim(),
        filters: dto.filters as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Update a saved filter preset (if owner)
   */
  async update(id: string, userId: string, dto: UpdateFilterDto): Promise<SavedFilter> {
    await this.findOne(id, userId);

    const data: Prisma.SavedFilterUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.filters !== undefined) data.filters = dto.filters as Prisma.InputJsonValue;

    return this.prisma.savedFilter.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a saved filter preset (ownership enforced)
   */
  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    await this.findOne(id, userId);

    await this.prisma.savedFilter.delete({
      where: { id },
    });

    return { success: true };
  }
}
