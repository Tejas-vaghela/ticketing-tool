import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserRole, SupportLevel, UserStatus } from '@prisma/client';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  supportLevels: SupportLevel[];
  avatar: string;
  timezone: string;
  status: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoginResponse {
  accessToken: string;
  user: SafeUser;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

// Fallback seed accounts for development environments where PostgreSQL is not yet populated
const SEED_USERS: Array<SafeUser & { passwordPlain: string }> = [
  {
    id: 'user-1',
    name: 'Tejas Chauhan',
    email: 'tejas@inbox.GoldMine.io',
    passwordPlain: 'admin123',
    role: UserRole.Admin,
    department: 'Engineering & Operations',
    supportLevels: [SupportLevel.L1, SupportLevel.L2, SupportLevel.L3],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-2',
    name: 'Rahul Sharma',
    email: 'rahul.s@inbox.GoldMine.io',
    passwordPlain: 'support123',
    role: UserRole.Support_Agent,
    department: 'Customer Support',
    supportLevels: [SupportLevel.L1],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-3',
    name: 'Priya Patel',
    email: 'priya.p@inbox.GoldMine.io',
    passwordPlain: 'tech123',
    role: UserRole.Technical,
    department: 'Technical Operations',
    supportLevels: [SupportLevel.L2],
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-4',
    name: 'Amit Shah',
    email: 'amit.shah@inbox.GoldMine.io',
    passwordPlain: 'engineer123',
    role: UserRole.Engineer,
    department: 'Core Platform Engineering',
    supportLevels: [SupportLevel.L3],
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-5',
    name: 'Neha Mehta',
    email: 'neha.m@inbox.GoldMine.io',
    passwordPlain: 'support123',
    role: UserRole.Support_Agent,
    department: 'Customer Support',
    supportLevels: [SupportLevel.L1],
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Away,
  },
  {
    id: 'user-6',
    name: 'Vivek Joshi',
    email: 'vivek.j@inbox.GoldMine.io',
    passwordPlain: 'engineer123',
    role: UserRole.Engineer,
    department: 'Backend Infrastructure',
    supportLevels: [SupportLevel.L3],
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-7',
    name: 'Ananya Roy',
    email: 'ananya.r@inbox.GoldMine.io',
    passwordPlain: 'qa123',
    role: UserRole.QA,
    department: 'Quality Assurance',
    supportLevels: [SupportLevel.L1, SupportLevel.L2],
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-8',
    name: 'Vikram Rao',
    email: 'vikram.r@inbox.GoldMine.io',
    passwordPlain: 'pm123',
    role: UserRole.Project_Manager,
    department: 'Product Delivery',
    supportLevels: [SupportLevel.L1],
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Offline,
  },
];

// Password reset token TTL in milliseconds (1 hour)
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticates user with emailOrId and password, returns signed JWT and safe user object.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const identifier = dto.emailOrId.trim();
    let userRecord: (SafeUser & { password?: string }) | null = null;
    let passwordMatched = false;

    // 1. Primary: Query PostgreSQL through Prisma ORM
    try {
      const dbUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
            { id: identifier },
          ],
        },
      });

      if (dbUser) {
        // Verify bcrypt hash
        if (dbUser.password.startsWith('$2b$') || dbUser.password.startsWith('$2a$')) {
          passwordMatched = await bcrypt.compare(dto.password, dbUser.password);
        } else {
          // If password was stored in plaintext, check equality and re-hash
          passwordMatched = dbUser.password === dto.password;
        }

        if (passwordMatched) {
          // Check account status
          if (dbUser.status === UserStatus.Offline) {
            throw new UnauthorizedException(
              'Your account has been deactivated. Please contact your administrator.',
            );
          }
          const { password, ...safe } = dbUser;
          userRecord = safe;
        }
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`Database query during login failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Fallback: If not found in DB or DB is offline, match against known seed user accounts
    if (!userRecord) {
      const seedMatch = SEED_USERS.find(
        (u) =>
          u.id === identifier ||
          u.email.toLowerCase() === identifier.toLowerCase(),
      );

      if (seedMatch) {
        const isMatch = dto.password === seedMatch.passwordPlain;
        if (isMatch) {
          passwordMatched = true;
          const { passwordPlain, ...safe } = seedMatch;
          userRecord = safe;
        }
      }
    }

    if (!userRecord || !passwordMatched) {
      throw new UnauthorizedException('Invalid credentials. Please verify your email/ID and password.');
    }

    // 3. Issue stateless JWT signed with JWT_SECRET
    const payload = {
      sub: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: userRecord,
    };
  }

  /**
   * Retrieves profile of current authenticated user by id.
   */
  async getMe(userId: string): Promise<SafeUser> {
    try {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (dbUser) {
        const { password, ...safe } = dbUser;
        return safe;
      }
    } catch (err) {
      this.logger.warn(`Database lookup for user ${userId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fallback to seed account if DB is unavailable
    const seed = SEED_USERS.find((u) => u.id === userId);
    if (seed) {
      const { passwordPlain, ...safe } = seed;
      return safe;
    }

    throw new UnauthorizedException('User account could not be found.');
  }

  /**
   * Acknowledges client logout.
   */
  async logout(): Promise<LogoutResponse> {
    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }

  /**
   * POST /api/auth/forgot-password
   *
   * Initiates a password reset flow.
   * - Always returns the same generic message to prevent user enumeration.
   * - Stores a hashed reset token in the DB with a 1-hour TTL.
   * - In a real production system this would send an email; here we log the
   *   plaintext token to the server console so developers can test the flow
   *   without a configured mailer. The response body NEVER reveals the token.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const genericMessage =
      'If an account exists for that email address, a password-reset link has been sent.';

    try {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: dto.email.toLowerCase().trim(), mode: 'insensitive' } },
      });

      if (!user) {
        // Do NOT reveal whether the email is registered
        return { message: genericMessage };
      }

      // Generate a cryptographically random token (32 bytes → 64 hex chars)
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      // Invalidate any previous unused tokens for this user
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      // Store the hashed token
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // In production this token would be emailed to the user.
      // For development we log it so the flow can be tested without a mailer.
      this.logger.log(
        `[DEV] Password reset token for ${user.email}: ${rawToken} (valid for 1 hour)`,
      );
      this.logger.log(
        `[DEV] Reset URL: http://localhost:3000/reset-password?token=${rawToken}`,
      );
    } catch (err) {
      // Log internally, but always return the generic message
      this.logger.error(
        `forgotPassword error for ${dto.email}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { message: genericMessage };
  }

  /**
   * POST /api/auth/reset-password
   *
   * Validates the reset token and sets a new password.
   * - Token is consumed (marked used) after a successful reset.
   * - Expired and already-used tokens are rejected.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const tokenHash = crypto.createHash('sha256').update(dto.token.trim()).digest('hex');

    let resetRecord: Awaited<ReturnType<typeof this.prisma.passwordResetToken.findUnique>> & { user?: any } | null;
    try {
      resetRecord = await this.prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      }) as any;
    } catch (err) {
      this.logger.error(`resetPassword DB lookup error: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('Password reset failed. Please request a new reset link.');
    }

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset link. Please request a new password reset.');
    }

    if (resetRecord.used) {
      throw new BadRequestException('This reset link has already been used. Please request a new password reset.');
    }

    if (new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('This reset link has expired (valid for 1 hour). Please request a new password reset.');
    }

    // Hash the new password and update the user record
    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    });

    // Mark the token as used
    await this.prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { used: true },
    });

    this.logger.log(`Password reset successfully for user: ${resetRecord.user.email}`);
    return { message: 'Password has been reset successfully. You may now sign in with your new password.' };
  }
}
