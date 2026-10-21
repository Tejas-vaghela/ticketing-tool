import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storageDir!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const configuredDir = this.configService.get<string>('ATTACHMENTS_STORAGE_DIR');
    this.storageDir = configuredDir
      ? path.resolve(configuredDir)
      : path.resolve(process.cwd(), 'uploads', 'attachments');

    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.log(`Created attachments storage directory: ${this.storageDir}`);
      } else {
        this.logger.log(`Using attachments storage directory: ${this.storageDir}`);
      }
    } catch (err) {
      this.logger.error(`Failed to initialize storage directory ${this.storageDir}:`, err);
      throw err;
    }
  }

  getStorageDirectory(): string {
    return this.storageDir;
  }

  /**
   * Sanitizes original client filenames to prevent path traversal and shell exploits.
   */
  sanitizeFilename(originalName: string): string {
    const basename = path.basename(originalName);
    const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized.length > 100 ? sanitized.substring(0, 100) : sanitized;
  }

  /**
   * Generates a collision-proof disk storage key.
   */
  getStorageKey(attachmentId: string, originalFilename: string): string {
    const cleanId = path.basename(attachmentId).replace(/[^a-zA-Z0-9_-]/g, '');
    return `${cleanId}_${this.sanitizeFilename(originalFilename)}`;
  }

  /**
   * Resolves the absolute path for an attachment on disk.
   */
  getFilePath(attachmentId: string, originalFilename: string): string {
    const safeKey = this.getStorageKey(attachmentId, originalFilename);
    const resolvedPath = path.resolve(this.storageDir, safeKey);
    const normalizedStorageDir = path.resolve(this.storageDir);

    if (!resolvedPath.startsWith(normalizedStorageDir)) {
      throw new BadRequestException('Path traversal attempt detected.');
    }
    return resolvedPath;
  }

  /**
   * Checks whether the file exists on disk.
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Writes file buffer to persistent disk storage.
   */
  async writeFile(attachmentId: string, originalFilename: string, buffer: Buffer): Promise<string> {
    const filePath = this.getFilePath(attachmentId, originalFilename);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Returns a readable stream for binary download.
   */
  createReadStream(filePath: string): fs.ReadStream {
    return fs.createReadStream(filePath);
  }

  /**
   * Safely unlinks a file from disk. Returns true if removed, false if not found.
   */
  async unlinkFile(filePath: string): Promise<boolean> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (err: any) {
      this.logger.error(`[STORAGE_ORPHAN_WARNING] Failed to unlink file at ${filePath}: ${err.message}`);
      return false;
    }
  }
}
