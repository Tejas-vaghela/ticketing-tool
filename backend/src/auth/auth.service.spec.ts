const vi = jest;
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus, SupportLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const mockJwtService = {
    signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should authenticate valid user from database and return JWT token', async () => {
      const hashedPassword = await bcrypt.hash('secret123', 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        name: 'Tejas',
        email: 'tejas@inbox.io',
        password: hashedPassword,
        role: UserRole.Admin,
        status: UserStatus.Active,
        department: 'Engineering',
        supportLevels: [SupportLevel.L1],
        avatar: '',
        timezone: 'UTC',
      });

      const res = await service.login({ emailOrId: 'tejas@inbox.io', password: 'secret123' });

      expect(res).toBeDefined();
      expect(res.accessToken).toBe('mock-jwt-token');
      expect(res.user.id).toBe('user-1');
      expect(mockJwtService.signAsync).toHaveBeenCalled();
    });

    it('should reject invalid password with UnauthorizedException', async () => {
      const hashedPassword = await bcrypt.hash('secret123', 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        name: 'Tejas',
        email: 'tejas@inbox.io',
        password: hashedPassword,
        role: UserRole.Admin,
        status: UserStatus.Active,
      });

      await expect(
        service.login({ emailOrId: 'tejas@inbox.io', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject deactivated offline user with UnauthorizedException', async () => {
      const hashedPassword = await bcrypt.hash('secret123', 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'tejas@inbox.io',
        password: hashedPassword,
        status: UserStatus.Offline,
      });

      await expect(
        service.login({ emailOrId: 'tejas@inbox.io', password: 'secret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fall back to known seed user when database returns no user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await service.login({
        emailOrId: 'tejas@inbox.GoldMine.io',
        password: 'admin123',
      });

      expect(res).toBeDefined();
      expect(res.user.id).toBe('user-1');
      expect(res.accessToken).toBe('mock-jwt-token');
    });

    it('should reject unknown user with UnauthorizedException', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ emailOrId: 'nonexistent@test.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('should return safe user by ID from database', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Tejas',
        email: 'tejas@inbox.io',
        role: UserRole.Admin,
      });

      const user = await service.getMe('user-1');
      expect(user.id).toBe('user-1');
    });

    it('should throw UnauthorizedException if user not found anywhere', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('user-unknown-999')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should acknowledge client logout', async () => {
      const res = await service.logout();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Logged out');
    });
  });

  describe('forgotPassword', () => {
    it('should return generic message even when user does not exist (prevents enumeration)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await service.forgotPassword({ email: 'ghost@test.com' });
      expect(res.message).toContain('password-reset link has been sent');
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should create a hashed token when user exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1', email: 'tejas@test.com' });
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({ id: 'tok-1' });

      const res = await service.forgotPassword({ email: 'tejas@test.com' });
      expect(res.message).toContain('password-reset link has been sent');
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reject when new password and confirm password do not match', async () => {
      await expect(
        service.resetPassword({
          token: 'tok-123',
          newPassword: 'newPassword123',
          confirmPassword: 'differentPassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully reset password when token is valid and unused', async () => {
      const token = 'valid-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        tokenHash,
        userId: 'user-1',
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
        user: { email: 'tejas@test.com' },
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });
      mockPrisma.passwordResetToken.update.mockResolvedValue({ id: 'tok-1', used: true });

      const res = await service.resetPassword({
        token,
        newPassword: 'newSecretPassword123',
        confirmPassword: 'newSecretPassword123',
      });

      expect(res.message).toContain('Password has been reset successfully');
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalled();
    });

    it('should reject when token is already used', async () => {
      const token = 'already-used-token';
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        used: true,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await expect(
        service.resetPassword({
          token,
          newPassword: 'pass',
          confirmPassword: 'pass',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when token is expired', async () => {
      const token = 'expired-token';
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        used: false,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      });

      await expect(
        service.resetPassword({
          token,
          newPassword: 'pass',
          confirmPassword: 'pass',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

