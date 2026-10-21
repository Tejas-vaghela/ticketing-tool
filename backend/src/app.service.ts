import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      status: 'ok',
      service: 'Ticketing Management Platform API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
