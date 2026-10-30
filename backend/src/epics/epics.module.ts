import { Module } from '@nestjs/common';
import { EpicsController } from './epics.controller.js';
import { EpicsService } from './epics.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [EpicsController],
  providers: [EpicsService],
  exports: [EpicsService],
})
export class EpicsModule {}
