import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import { AttachmentResponseDto } from './dto/attachment-response.dto';
import { UserRole } from '@prisma/client';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  department?: string;
  supportLevels?: string[];
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'dll', 'so', 'dylib', 'bin', 'com', 'scr',
  'sh', 'bash', 'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'jar', 'svg',
]);

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  json: 'application/json',
  har: 'application/json',
  csv: 'text/csv',
  log: 'text/plain',
  txt: 'text/plain',
  md: 'text/markdown',
  xml: 'application/xml',
};

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Generates a unique attachment identifier conforming to CUID-like length/uniqueness.
   */
  private generateAttachmentId(): string {
    const timestampPart = Date.now().toString(36);
    const randomPart = randomUUID().replace(/-/g, '').substring(0, 16);
    return `c${timestampPart}${randomPart}`;
  }

  /**
   * Extracts the lowercase file extension without the leading dot.
   */
  private getExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
    return ext;
  }

  /**
   * Validates file content using binary magic numbers or text encoding rules.
   */
  private validateContent(ext: string, buffer: Buffer): void {
    // 1. Binary Formats Validation (Magic-Number Signatures)
    if (ext === 'png') {
      const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      if (buffer.length < pngSig.length || !pngSig.every((b, i) => buffer[i] === b)) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (ext === 'jpg' || ext === 'jpeg') {
      if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (ext === 'gif') {
      const gif87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
      const gif89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
      const is87 = buffer.length >= 6 && gif87.every((b, i) => buffer[i] === b);
      const is89 = buffer.length >= 6 && gif89.every((b, i) => buffer[i] === b);
      if (!is87 && !is89) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (ext === 'webp') {
      if (
        buffer.length < 12 ||
        buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46 || // RIFF
        buffer[8] !== 0x57 || buffer[9] !== 0x45 || buffer[10] !== 0x42 || buffer[11] !== 0x50  // WEBP
      ) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (ext === 'pdf') {
      const pdfSig = [0x25, 0x50, 0x44, 0x46]; // %PDF
      if (buffer.length < 4 || !pdfSig.every((b, i) => buffer[i] === b)) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (['zip', 'docx', 'xlsx', 'pptx'].includes(ext)) {
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (ext === 'gz') {
      if (buffer.length < 2 || buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (ext === '7z') {
      const sig7z = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];
      if (buffer.length < sig7z.length || !sig7z.every((b, i) => buffer[i] === b)) {
        throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
      }
      return;
    }

    if (ext === 'tar') {
      if (buffer.length >= 262) {
        const ustar = [0x75, 0x73, 0x74, 0x61, 0x72]; // ustar
        const isUstar = ustar.every((b, i) => buffer[257 + i] === b);
        if (!isUstar) {
          throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
        }
        return;
      }
      throw new UnsupportedMediaTypeException(`File content does not match declared extension .${ext}.`);
    }

    // 2. Plain Text & Structured Data Formats Validation
    if (['log', 'txt', 'json', 'csv', 'har', 'md', 'xml'].includes(ext)) {
      // Must not start with executable binary signatures
      if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
        // MZ header (Windows PE executable)
        throw new UnsupportedMediaTypeException(`Executable binary header detected in file declared as .${ext}.`);
      }
      if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
        // ELF header (Linux binary)
        throw new UnsupportedMediaTypeException(`Executable binary header detected in file declared as .${ext}.`);
      }

      // Check for binary null bytes
      for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
        if (buffer[i] === 0x00) {
          throw new UnsupportedMediaTypeException(`Binary null byte detected in text file declared as .${ext}.`);
        }
      }

      // Must be valid UTF-8
      const text = buffer.toString('utf-8');
      if (text.includes('\uFFFD') && buffer.includes(0xef) && buffer.includes(0xbf) && buffer.includes(0xbd)) {
        // Contains invalid UTF-8 replacement char
        throw new UnsupportedMediaTypeException(`File content contains invalid character encoding for .${ext}.`);
      }

      // Format-specific verification
      if (ext === 'json' || ext === 'har') {
        try {
          JSON.parse(text);
        } catch {
          throw new UnsupportedMediaTypeException(`File content is not valid JSON.`);
        }
      }

      return;
    }

    // Fallback: If extension is not recognized, reject
    throw new UnsupportedMediaTypeException(`File extension .${ext} is not supported.`);
  }

  /**
   * Resolves the authoritative MIME type derived from content and normalized extension.
   */
  private resolveAuthoritativeMime(ext: string): string {
    return MIME_MAP[ext] || 'application/octet-stream';
  }

  /**
   * Upload an attachment to an issue with atomic metadata/audit persistence and rollback.
   */
  async uploadAttachment(
    issueId: string,
    file: { originalname: string; buffer: Buffer; size: number },
    currentUser: AuthenticatedUser,
  ): Promise<AttachmentResponseDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("File is required. Multipart field name must be 'file'.");
    }

    // 1. File Size Verification
    if (file.size > MAX_FILE_SIZE || file.buffer.length > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum permitted limit of 25MB (${MAX_FILE_SIZE} bytes).`,
      );
    }

    // 2. Extension Blacklist Verification
    const ext = this.getExtension(file.originalname);
    if (!ext || BLOCKED_EXTENSIONS.has(ext)) {
      throw new UnsupportedMediaTypeException(
        `File extension .${ext || 'unknown'} is disallowed for security policies.`,
      );
    }

    // 3. Content Signature & Structure Verification
    this.validateContent(ext, file.buffer);
    const authoritativeMime = this.resolveAuthoritativeMime(ext);

    // 4. Verify Parent Issue Exists in PostgreSQL
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) {
      throw new NotFoundException(`Issue with identifier ${issueId} not found.`);
    }

    // 5. Generate Safe Identifier and Storage Key
    const attachmentId = this.generateAttachmentId();
    const cleanFilename = this.storageService.sanitizeFilename(file.originalname);

    // 6. Write Physical Binary to Storage
    let physicalPath: string;
    try {
      physicalPath = await this.storageService.writeFile(
        attachmentId,
        cleanFilename,
        file.buffer,
      );
    } catch (err: any) {
      this.logger.error(`Storage write failure: ${err.message}`, err.stack);
      throw err;
    }

    // 7. Atomic Prisma Transaction (Attachment + ActivityEvent)
    try {
      const [attachment] = await this.prisma.$transaction([
        this.prisma.attachment.create({
          data: {
            id: attachmentId,
            issueId,
            filename: file.originalname,
            fileType: authoritativeMime,
            fileSize: file.buffer.length,
          },
        }),
        this.prisma.activityEvent.create({
          data: {
            issueId,
            userId: currentUser.id,
            action: 'attachment_added',
            details: JSON.stringify({
              attachmentId,
              filename: file.originalname,
              fileSize: file.buffer.length,
              uploaderId: currentUser.id,
            }),
          },
        }),
      ]);

      this.logger.log(
        `Attachment ${attachment.id} (${attachment.filename}) uploaded to issue ${issueId} by user ${currentUser.id}.`,
      );

      return {
        id: attachment.id,
        issueId: attachment.issueId,
        filename: attachment.filename,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        uploadDate: attachment.uploadDate,
      };
    } catch (dbError: any) {
      // 8. Rollback: Unlink physical file immediately if database transaction fails
      this.logger.error(
        `Database transaction failed for attachment ${attachmentId}. Initiating rollback of physical file at ${physicalPath}: ${dbError.message}`,
      );
      await this.storageService.unlinkFile(physicalPath);
      throw dbError;
    }
  }

  /**
   * List all attachments for a specific issue.
   */
  async listAttachments(issueId: string): Promise<AttachmentResponseDto[]> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });
    if (!issue) {
      throw new NotFoundException(`Issue with identifier ${issueId} not found.`);
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { issueId },
      orderBy: { uploadDate: 'asc' },
    });

    return attachments.map((att) => ({
      id: att.id,
      issueId: att.issueId,
      filename: att.filename,
      fileType: att.fileType,
      fileSize: att.fileSize,
      uploadDate: att.uploadDate,
    }));
  }

  /**
   * Retrieve metadata for a single attachment by ID.
   */
  async getAttachmentMetadata(id: string): Promise<AttachmentResponseDto> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment with identifier ${id} not found.`);
    }

    return {
      id: attachment.id,
      issueId: attachment.issueId,
      filename: attachment.filename,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      uploadDate: attachment.uploadDate,
    };
  }

  /**
   * Resolves physical file path and metadata for binary download stream.
   */
  async getDownloadStream(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment with identifier ${id} not found.`);
    }

    const filePath = this.storageService.getFilePath(attachment.id, attachment.filename);
    if (!this.storageService.fileExists(filePath)) {
      this.logger.error(`Physical file missing on server storage for attachment ${id}: ${filePath}`);
      throw new NotFoundException(
        `Attachment file ${attachment.filename} not found on server storage.`,
      );
    }

    const stream = this.storageService.createReadStream(filePath);
    return {
      stream,
      filename: attachment.filename,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
    };
  }

  /**
   * Delete an attachment and unlink its physical binary file.
   */
  async deleteAttachment(
    issueId: string,
    attachmentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ message: string; id: string; success: boolean }> {
    // 1. Verify existence and issue binding
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.issueId !== issueId) {
      throw new NotFoundException(
        `Attachment with identifier ${attachmentId} not found on issue ${issueId}.`,
      );
    }

    // 2. Pre-Migration RBAC Enforcement: Only Admin and Project_Manager
    if (
      currentUser.role !== UserRole.Admin &&
      currentUser.role !== UserRole.Project_Manager
    ) {
      throw new ForbiddenException(
        'Forbidden resource. You do not have permission to delete this attachment.',
      );
    }

    // 3. Resolve physical path before record removal
    const filePath = this.storageService.getFilePath(attachment.id, attachment.filename);

    // 4. Atomic Database Deletion + Activity Event Logging
    await this.prisma.$transaction([
      this.prisma.attachment.delete({
        where: { id: attachmentId },
      }),
      this.prisma.activityEvent.create({
        data: {
          issueId,
          userId: currentUser.id,
          action: 'attachment_deleted',
          details: JSON.stringify({
            attachmentId,
            filename: attachment.filename,
          }),
        },
      }),
    ]);

    // 5. Subsequent Physical File Removal
    const unlinked = await this.storageService.unlinkFile(filePath);
    if (!unlinked) {
      this.logger.warn(
        `[STORAGE_ORPHAN_WARNING] Failed to unlink physical file after database deletion. ` +
        `Attachment ID: ${attachmentId}, Issue ID: ${issueId}, Path: ${filePath}`,
      );
    }

    this.logger.log(`Attachment ${attachmentId} permanently deleted by user ${currentUser.id}.`);

    return {
      message: `Attachment ${attachment.filename} permanently deleted.`,
      id: attachment.id,
      success: true,
    };
  }

  /**
   * Cross-Module Cleanup Helper: Unlinks physical files for a list of attachments.
   * Invoked during parent issue deletion before PostgreSQL cascade deletion.
   */
  async deleteFilesForIssue(attachments: { id: string; filename: string }[]): Promise<void> {
    for (const att of attachments) {
      const filePath = this.storageService.getFilePath(att.id, att.filename);
      await this.storageService.unlinkFile(filePath);
    }
  }
}
