import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  const mockSafeUser = {
    id: 'user-uuid-1',
    name: 'Tejas Vaghela',
    email: 'admin@example.com',
    role: UserRole.Admin,
    department: 'Engineering',
    supportLevels: ['L1', 'L2', 'L3'],
    avatar: 'https://avatar.url',
    timezone: 'UTC',
    status: 'Active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLoginResponse = {
    accessToken: 'mock-jwt-token',
    user: mockSafeUser,
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(mockLoginResponse),
      getMe: jest.fn().mockResolvedValue(mockSafeUser),
      logout: jest.fn().mockResolvedValue({ message: 'Successfully logged out' }),
      forgotPassword: jest.fn().mockResolvedValue({
        message: 'If an account exists with that email, a password reset link has been sent.',
      }),
      resetPassword: jest.fn().mockResolvedValue({
        message: 'Password has been reset successfully. You can now log in with your new password.',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return token and user on successful authentication', async () => {
      const loginDto = { emailOrId: 'admin@example.com', password: 'password123' };
      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockLoginResponse);
    });
  });

  describe('getMe', () => {
    it('should return authenticated user profile from id', async () => {
      const reqUser = { id: 'user-uuid-1', role: 'Admin' };
      const result = await controller.getMe(reqUser);

      expect(authService.getMe).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockSafeUser);
    });

    it('should fallback to sub if id is not present', async () => {
      const reqUser = { sub: 'user-uuid-1', role: 'Admin' };
      const result = await controller.getMe(reqUser);

      expect(authService.getMe).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockSafeUser);
    });
  });

  describe('logout', () => {
    it('should return logout success message', async () => {
      const result = await controller.logout();

      expect(authService.logout).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Successfully logged out' });
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword and return generic response', async () => {
      const dto = { email: 'admin@example.com' };
      const result = await controller.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toContain('If an account exists');
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword and return success response', async () => {
      const dto = {
        token: 'valid-reset-token',
        newPassword: 'NewSecurePassword123!',
        confirmPassword: 'NewSecurePassword123!',
      };
      const result = await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toContain('Password has been reset successfully');
    });
  });
});
