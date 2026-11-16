import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { put, del, get, head } from '@vercel/blob';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storageDir!: string;
  private blobToken: string | null = null;
  private blobAccess: 'private' | 'public' = 'private';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.blobToken =
      this.configService.get<string>('BLOB_READ_WRITE_TOKEN') ||
      process.env.BLOB_READ_WRITE_TOKEN ||
      null;

    const accessEnv =
      this.configService.get<string>('BLOB_ACCESS') ||
      process.env.BLOB_ACCESS ||
      'private';
    this.blobAccess = accessEnv === 'public' ? 'public' : 'private';

    const configuredDir = this.configService.get<string>('ATTACHMENTS_STORAGE_DIR');
    const defaultDir = process.env.VERCEL
      ? path.resolve('/tmp', 'attachments')
      : path.resolve(process.cwd(), 'uploads', 'attachments');

    this.storageDir = configuredDir ? path.resolve(configuredDir) : defaultDir;

    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.log(`Created attachments storage directory: ${this.storageDir}`);
      } else {
        this.logger.log(`Using attachments storage directory: ${this.storageDir}`);
      }
    } catch (err: any) {
      this.logger.warn(
        `Local storage directory ${this.storageDir} initialization warning: ${err.message}`,
      );
    }

    if (this.isBlobStorageEnabled()) {
      const authType = this.blobToken ? 'Static Token' : 'OIDC / Ambient Platform Auth';
      this.logger.log(
        `Permanent cloud storage enabled via Vercel Blob (Auth: ${authType}, Access: ${this.blobAccess}).`,
      );
    } else {
      this.logger.log('Vercel Blob not detected; using local filesystem storage.');
    }
  }

  /**
   * Checks whether Vercel Blob is enabled via static token, OIDC environment, or Vercel store ID.
   */
  isBlobStorageEnabled(): boolean {
    return Boolean(
      this.blobToken ||
        process.env.BLOB_STORE_ID ||
        process.env.VERCEL_OIDC_TOKEN ||
        (process.env.VERCEL && process.env.BLOB_STORE_ID),
    );
  }

  /**
   * Helper to merge token options only if static token is configured (allowing native OIDC fallback).
   */
  private getBlobOptions<T extends object = Record<string, never>>(extra: T = {} as T): T & { token?: string } {
    return this.blobToken ? { ...extra, token: this.blobToken } : { ...extra };
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
   * Generates a collision-proof disk/cloud storage key.
   */
  getStorageKey(attachmentId: string, originalFilename: string): string {
    const cleanId = path.basename(attachmentId).replace(/[^a-zA-Z0-9_-]/g, '');
    return `${cleanId}_${this.sanitizeFilename(originalFilename)}`;
  }

  /**
   * Resolves the absolute path for an attachment on local disk.
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
   * Checks whether the file exists on local disk.
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Ensures file is cached locally on this serverless instance.
   * If absent locally but Vercel Blob is enabled, retrieves it from cloud storage.
   */
  async ensureFileLocally(attachmentId: string, originalFilename: string): Promise<string> {
    const filePath = this.getFilePath(attachmentId, originalFilename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    if (this.isBlobStorageEnabled()) {
      const blobKey = `attachments/${this.getStorageKey(attachmentId, originalFilename)}`;
      try {
        if (this.blobAccess === 'private') {
          // Private store: fetch authenticated binary stream
          const blobRes = await get(blobKey, this.getBlobOptions({ access: 'private' }));
          if (blobRes && (blobRes as any).stream) {
            const chunks: Buffer[] = [];
            for await (const chunk of (blobRes as any).stream) {
              chunks.push(Buffer.from(chunk));
            }
            await fs.promises.writeFile(filePath, Buffer.concat(chunks));
            return filePath;
          }
        } else {
          // Public store: resolve downloadUrl via head
          const details = await head(blobKey, this.getBlobOptions());
          if (details && details.downloadUrl) {
            const res = await fetch(details.downloadUrl);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
              return filePath;
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not fetch attachment from Vercel Blob (${blobKey}): ${err.message}`);
      }
    }

    return filePath;
  }

  /**
   * Writes file buffer to storage (local disk and permanent Vercel Blob if enabled).
   */
  async writeFile(attachmentId: string, originalFilename: string, buffer: Buffer): Promise<string> {
    const filePath = this.getFilePath(attachmentId, originalFilename);

    // 1. Write to local cache/disk
    try {
      await fs.promises.writeFile(filePath, buffer);
    } catch (fsErr: any) {
      this.logger.warn(`Failed writing to local path ${filePath}: ${fsErr.message}`);
    }

    // 2. Write to Vercel Blob if enabled (Permanent Cloud Storage)
    if (this.isBlobStorageEnabled()) {
      const blobKey = `attachments/${this.getStorageKey(attachmentId, originalFilename)}`;
      try {
        await put(
          blobKey,
          buffer,
          this.getBlobOptions({
            access: this.blobAccess,
            addRandomSuffix: false,
          }),
        );
        this.logger.log(
          `Attachment permanently stored in Vercel Blob (${this.blobAccess}): ${blobKey}`,
        );
      } catch (blobErr: any) {
        this.logger.error(`Vercel Blob upload failed for ${blobKey}: ${blobErr.message}`);
        throw blobErr;
      }
    }

    return filePath;
  }

  /**
   * Returns a readable stream for binary download.
   */
  createReadStream(filePath: string): fs.ReadStream {
    return fs.createReadStream(filePath);
  }

  /**
   * Safely unlinks a file from disk and cloud storage. Returns true if removed, false if not found.
   */
  async unlinkFile(filePath: string): Promise<boolean> {
    let removed = false;

    // 1. Remove from local disk
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        removed = true;
      }
    } catch (err: any) {
      this.logger.error(
        `[STORAGE_ORPHAN_WARNING] Failed to unlink local file at ${filePath}: ${err.message}`,
      );
    }

    // 2. Remove from Vercel Blob if enabled
    if (this.isBlobStorageEnabled()) {
      const basename = path.basename(filePath);
      const blobKey = `attachments/${basename}`;
      try {
        await del(blobKey, this.getBlobOptions());
        removed = true;
      } catch (err: any) {
        this.logger.warn(`Failed to delete blob from Vercel Blob: ${err.message}`);
      }
    }

    return removed;
  }
}
