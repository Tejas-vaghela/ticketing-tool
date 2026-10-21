import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

export const createValidationPipe = (options?: ValidationPipeOptions): ValidationPipe => {
  return new ValidationPipe({
    whitelist: true,              // Strips unexpected fields not in DTO
    forbidNonWhitelisted: true,    // Throws 400 if extra properties are sent
    transform: true,              // Automatically coerces payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true,
    },
    ...options,
  });
};
