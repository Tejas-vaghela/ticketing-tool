import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { EscalateIssueDto } from './dto/escalate-issue.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('issues')
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  /**
   * GET /api/issues — Retrieve issues list with optional filters
   */
  @Get()
  async findAll(@Query() query: any) {
    return this.issuesService.findAll(query);
  }

  /**
   * GET /api/issues/:id — Retrieve single issue details with relations
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.issuesService.findById(id);
  }

  /**
   * POST /api/issues — Create a new ticket (triggers assignment notification)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateIssueDto, @CurrentUser() user: any) {
    return this.issuesService.create(dto, user);
  }

  /**
   * PATCH /api/issues/:id — Update issue fields (triggers assignment notification on reassign)
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: any,
  ) {
    return this.issuesService.update(id, dto, user);
  }

  /**
   * PATCH /api/issues/:id/status — Dedicated status transition (triggers status notification)
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.issuesService.updateStatus(id, dto.status, user);
  }

  /**
   * POST /api/issues/:id/escalate — Escalate support level (triggers escalation notification)
   */
  @Post(':id/escalate')
  @HttpCode(HttpStatus.OK)
  async escalate(
    @Param('id') id: string,
    @Body() dto: EscalateIssueDto,
    @CurrentUser() user: any,
  ) {
    return this.issuesService.escalate(id, dto, user);
  }

  /**
   * POST /api/issues/:id/comments — Add comment (triggers comment notification)
   */
  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.issuesService.addComment(id, dto, user);
  }

  /**
   * GET /api/issues/:id/comments — List comments for an issue
   */
  @Get(':id/comments')
  async listComments(@Param('id') id: string) {
    return this.issuesService.listComments(id);
  }
}
