import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as expressLib from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { resolveOriginalUrl } from './common/utils/routing.util';

// Robust cross-runtime express factory (handles both CJS require and ESM interop)
const expressFactory: typeof expressLib =
  (expressLib as any).default && typeof (expressLib as any).default === 'function'
    ? (expressLib as any).default
    : expressLib;

export { resolveOriginalUrl };

let cachedServer: Express;

export async function bootstrapServer(): Promise<Express> {
  if (!cachedServer) {
    const server = expressFactory();

    // Edge-rewrite normalizer middleware
    server.use((req: Request, _res: Response, next: NextFunction) => {
      const resolved = resolveOriginalUrl(req);
      if (resolved && req.url !== resolved) {
        req.url = resolved;
      }
      next();
    });

    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

    // Global prefix for all REST endpoints: /api/*
    app.setGlobalPrefix('api');

    // CORS configuration for serverless execution
    app.enableCors({
      origin: true,
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global exception filters
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaExceptionFilter(),
    );

    await app.init();
    cachedServer = server;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();

  const resolved = resolveOriginalUrl(req);
  if (resolved && req.url !== resolved) {
    req.url = resolved;
  }

  return server(req, res);
}
