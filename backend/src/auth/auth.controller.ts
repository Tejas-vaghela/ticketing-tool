import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  AuthService,
  LoginResponse,
  SafeUser,
  LogoutResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
} from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Public endpoint authenticating credentials and issuing JWT.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  /**
   * GET /api/auth/me
   * Protected endpoint returning active user profile.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: any): Promise<SafeUser> {
    const userId = user.id || user.sub;
    return this.authService.getMe(userId);
  }

  /**
   * POST /api/auth/logout
   * Protected endpoint confirming client session termination.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(): Promise<LogoutResponse> {
    return this.authService.logout();
  }

  /**
   * POST /api/auth/forgot-password
   * Public endpoint that initiates the password-reset flow.
   * Always returns the same generic message to prevent user enumeration.
   * In development, the raw token is printed to the server console.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /api/auth/reset-password
   * Public endpoint that validates the reset token and sets a new password.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(dto);
  }
}
