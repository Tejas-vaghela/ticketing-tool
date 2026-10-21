import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';

/**
 * UsersModule — manages the /api/users REST API.
 *
 * Dependencies:
 *   - PrismaModule is @Global() so PrismaService is auto-available without explicit import.
 *   - AuthModule is imported to provide JwtModule and PassportModule for JwtAuthGuard.
 *
 * Registration:
 *   This module is registered in AppModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
