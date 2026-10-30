export interface SystemMemoryInfo {
  rssMb: number;
  heapTotalMb: number;
  heapUsedMb: number;
  externalMb: number;
}

export interface SystemApplicationInfo {
  name: string;
  version: string;
  environment: string;
}

export interface SystemRuntimeInfo {
  nodeVersion: string;
  platform: string;
  uptimeSeconds: number;
  memory: SystemMemoryInfo;
}

export interface SystemDatabaseInfo {
  provider: string;
  client: string;
  connectionStatus: 'connected' | 'disconnected' | 'unknown';
}

export interface SystemInfoResponseDto {
  success: boolean;
  data: {
    application: SystemApplicationInfo;
    runtime: SystemRuntimeInfo;
    database: SystemDatabaseInfo;
  };
}
