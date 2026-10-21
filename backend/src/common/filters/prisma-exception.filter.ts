import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'An unexpected database error occurred.';
    let error: string = 'Internal Server Error';

    switch (exception.code) {
      case 'P2002': {
        statusCode = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') || 'field';
        message = `Unique constraint violation on ${target}. A record with this value already exists.`;
        error = 'Conflict';
        break;
      }
      case 'P2025': {
        statusCode = HttpStatus.NOT_FOUND;
        message = (exception.meta?.cause as string) || 'The requested record was not found.';
        error = 'Not Found';
        break;
      }
      case 'P2003': {
        statusCode = HttpStatus.BAD_REQUEST;
        const field = (exception.meta?.field_name as string) || 'foreign key';
        message = `Foreign key constraint failed on ${field}.`;
        error = 'Bad Request';
        break;
      }
      default: {
        this.logger.error(`Unhandled Prisma error [${exception.code}]: ${exception.message}`);
        message = 'Database operation failed.';
        break;
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
