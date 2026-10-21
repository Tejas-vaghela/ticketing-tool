import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('PostgreSQL database connected successfully via Prisma');
    } catch (error) {
      this.logger.warn(
        `Database connection could not be established on startup: ${
          error instanceof Error ? error.message : String(error)
        }. Ensure PostgreSQL is running and DATABASE_URL is reachable.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('PostgreSQL database disconnected cleanly');
  }
}
