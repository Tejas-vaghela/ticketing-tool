import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SystemController } from './system.controller.js';
import { SystemService } from './system.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
