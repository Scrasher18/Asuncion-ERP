export interface TelemetryPointDto {
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDegrees?: number;
  timestamp: string;
}

export interface LiveTrackingResponse {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  status?: string;
  driverId?: number;
  driverName?: string;
  driverPhone?: string;
  currentLatitude: number;
  currentLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationAddress: string;
  originLatitude: number;
  originLongitude: number;
  branchName: string;
  speedKmh: number;
  headingDegrees: number;
  distanceRemainingMeters?: number;
  etaMinutes?: number;
  statusMessage: string;
  isLive: boolean;
  lastPingAt: string;
  routeHistory: TelemetryPointDto[];
  noSqlEngine: string;
  noSqlCollection: string;
}

export interface DriverLocationPingRequest {
  orderId?: number;
  orderNumber?: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  headingDegrees?: number;
  accuracyMeters?: number;
  batteryPercent?: number;
  status?: string;
  notes?: string;
}

export interface NoSqlDatabaseInfo {
  engine: string;
  database: string;
  collection: string;
  connected: boolean;
  totalDocuments: number;
  storagePath: string;
  activeTracksCount: number;
  statusMessage: string;
}
