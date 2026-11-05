import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import {
  BadRequestException,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: any;
  let storageService: any;

  beforeEach(async () => {
    prisma = {
      attachment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      issue: {
        findUnique: jest.fn(),
      },
      activityEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    storageService = {
      writeFile: jest.fn().mockResolvedValue('/mock/path/file.png'),
      unlinkFile: jest.fn().mockResolvedValue(true),
      getFilePath: jest.fn().mockReturnValue('/mock/path/file.png'),
      fileExists: jest.fn().mockReturnValue(true),
      sanitizeFilename: jest.fn().mockImplementation((fn: string) => fn),
      createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('file validation', () => {
    it('should reject blocked executable file extensions', async () => {
      const mockFile: any = {
        originalname: 'malware.exe',
        buffer: Buffer.from('malicious content'),
        size: 100,
        mimetype: 'application/octet-stream',
      };

      await expect(
        service.uploadAttachment('issue-1', mockFile, {
          id: 'user-1',
          email: 'admin@example.com',
          role: UserRole.Admin,
        }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject files exceeding maximum size limit', async () => {
      const mockFile: any = {
        originalname: 'huge_file.png',
        buffer: Buffer.alloc(26 * 1024 * 1024), // 26 MB (> 25 MB limit)
        size: 26 * 1024 * 1024,
        mimetype: 'image/png',
      };

      await expect(
        service.uploadAttachment('issue-1', mockFile, {
          id: 'user-1',
          email: 'admin@example.com',
          role: UserRole.Admin,
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject spoofed file headers', async () => {
      const mockFile: any = {
        originalname: 'fake_image.png',
        buffer: Buffer.from('not a real PNG header'),
        size: 20,
        mimetype: 'image/png',
      };

      prisma.issue.findUnique.mockResolvedValue({ id: 'issue-1' });

      await expect(
        service.uploadAttachment('issue-1', mockFile, {
          id: 'user-1',
          email: 'admin@example.com',
          role: UserRole.Admin,
        }),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });
  });

  describe('listAttachments', () => {
    it('should return attachments for an issue', async () => {
      const mockAttachment = {
        id: 'att-1',
        filename: 'report.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        issueId: 'issue-1',
        uploadDate: new Date(),
      };

      prisma.issue.findUnique.mockResolvedValue({ id: 'issue-1' });
      prisma.attachment.findMany.mockResolvedValue([mockAttachment]);

      const result = await service.listAttachments('issue-1');

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('report.pdf');
    });

    it('should throw NotFoundException if issue does not exist', async () => {
      prisma.issue.findUnique.mockResolvedValue(null);

      await expect(service.listAttachments('invalid-issue')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAttachment', () => {
    it('should allow Admin to delete an attachment', async () => {
      const mockAttachment = {
        id: 'att-1',
        filename: 'report.pdf',
        issueId: 'issue-1',
      };

      prisma.attachment.findUnique.mockResolvedValue(mockAttachment);
      prisma.$transaction.mockResolvedValue([mockAttachment, {}]);

      const result = await service.deleteAttachment('issue-1', 'att-1', {
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.Admin,
      });

      expect(result.success).toBe(true);
      expect(storageService.unlinkFile).toHaveBeenCalled();
    });

    it('should prevent non-admin from deleting an attachment', async () => {
      const mockAttachment = {
        id: 'att-1',
        filename: 'report.pdf',
        issueId: 'issue-1',
      };

      prisma.attachment.findUnique.mockResolvedValue(mockAttachment);

      await expect(
        service.deleteAttachment('issue-1', 'att-1', {
          id: 'user-2',
          email: 'dev@example.com',
          role: UserRole.Developer,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
