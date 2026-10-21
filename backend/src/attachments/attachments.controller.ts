import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { AttachmentsService, AuthenticatedUser } from './attachments.service';
import { AttachmentResponseDto } from './dto/attachment-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Response } from 'express';

export interface UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  // --------------------------------------------------------------------------
  // POST /api/issues/:issueId/attachments
  // Upload a single file attachment to an issue.
  // Roles: Admin, Project_Manager, Developer, QA, Support_Agent, Technical, Engineer
  // --------------------------------------------------------------------------
  @Post('issues/:issueId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.Admin,
    UserRole.Project_Manager,
    UserRole.Developer,
    UserRole.QA,
    UserRole.Support_Agent,
    UserRole.Technical,
    UserRole.Engineer,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
    }),
  )
  async uploadAttachment(
    @Param('issueId') issueId: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttachmentResponseDto> {
    if (!file) {
      throw new BadRequestException("File is required. Multipart field name must be 'file'.");
    }

    return this.attachmentsService.uploadAttachment(
      issueId,
      {
        originalname: file.originalname,
        buffer: file.buffer,
        size: file.size,
      },
      user,
    );
  }

  // --------------------------------------------------------------------------
  // GET /api/issues/:issueId/attachments
  // List all attachments belonging to an issue.
  // Roles: All authenticated roles
  // --------------------------------------------------------------------------
  @Get('issues/:issueId/attachments')
  @HttpCode(HttpStatus.OK)
  async listAttachments(
    @Param('issueId') issueId: string,
  ): Promise<AttachmentResponseDto[]> {
    return this.attachmentsService.listAttachments(issueId);
  }

  // --------------------------------------------------------------------------
  // GET /api/attachments/:id
  // Get single attachment metadata record by ID.
  // Roles: All authenticated roles
  // --------------------------------------------------------------------------
  @Get('attachments/:id')
  @HttpCode(HttpStatus.OK)
  async getAttachmentMetadata(
    @Param('id') id: string,
  ): Promise<AttachmentResponseDto> {
    return this.attachmentsService.getAttachmentMetadata(id);
  }

  // --------------------------------------------------------------------------
  // GET /api/attachments/:id/download
  // Stream raw binary file for download with RFC headers and nosniff.
  // Roles: All authenticated roles
  // --------------------------------------------------------------------------
  @Get('attachments/:id/download')
  @HttpCode(HttpStatus.OK)
  async downloadAttachment(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, filename, fileType, fileSize } =
      await this.attachmentsService.getDownloadStream(id);

    res.set({
      'Content-Type': fileType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': fileSize.toString(),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(stream);
  }

  // --------------------------------------------------------------------------
  // DELETE /api/issues/:issueId/attachments/:attachmentId
  // Delete an attachment record and unlink its physical binary file.
  // Roles: Admin, Project_Manager (Pre-Migration Policy)
  // --------------------------------------------------------------------------
  @Delete('issues/:issueId/attachments/:attachmentId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async deleteAttachment(
    @Param('issueId') issueId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string; id: string; success: boolean }> {
    return this.attachmentsService.deleteAttachment(issueId, attachmentId, user);
  }
}
