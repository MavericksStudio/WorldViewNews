/**
 * Core domain types for WorldViewNews.
 * All types are exported for use across the application.
 */

export type SourceCategory =
  | 'conflict'
  | 'aviation'
  | 'maritime'
  | 'environment'
  | 'economic'
  | 'market'
  | 'space'
  | 'news'
  | 'weather';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AlertTier = 'FLASH' | 'PRIORITY' | 'ROUTINE';

export interface GeoLocation {
  lat: number;
  lon: number;
  name: string;
  country?: string;
}

export interface IntelligenceItem {
  id: string;
  source: string;
  category: SourceCategory;
  title: string;
  description: string;
  timestamp: Date;
  location?: GeoLocation;
  severity: Severity;
  url?: string;
  tags: string[];
  raw?: unknown;
}

export interface SweepContext {
  sweepId: string;
  startedAt: Date;
  sources: string[];
}

export interface SweepResult {
  sweepId: string;
  startedAt: Date;
  completedAt: Date;
  items: IntelligenceItem[];
  errors: SweepError[];
  sourcesQueried: number;
  sourcesSucceeded: number;
}

export interface SweepError {
  source: string;
  error: string;
  timestamp: Date;
}

export interface DeltaChange {
  type: 'new' | 'threshold' | 'spike' | 'resolved';
  item: IntelligenceItem;
  tier: AlertTier;
  reason: string;
  previousValue?: number;
  currentValue?: number;
}

export interface Alert {
  id: string;
  tier: AlertTier;
  change: DeltaChange;
  createdAt: Date;
  deliveredAt?: Date;
  channels: string[];
}
