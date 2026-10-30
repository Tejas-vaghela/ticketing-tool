export interface DatabaseHealthStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface ApplicationHealthStatus {
  status: 'up' | 'down';
  memoryUsageMb: number;
}

export interface SystemHealthResponseDto {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  services: {
    database: DatabaseHealthStatus;
    application: ApplicationHealthStatus;
  };
}
