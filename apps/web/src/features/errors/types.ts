export type ErrorSource = 'SERVER' | 'CLIENT';
export type ErrorSeverity = 'ERROR' | 'WARNING';
export type ErrorKind = 'HTTP' | 'UNHANDLED' | 'UI_CRASH' | 'UI_ERROR' | 'API_ERROR' | 'NETWORK';

export interface ErrorUser {
  id: string;
  accountNumber: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

export interface ErrorLogItem {
  id: string;
  source: ErrorSource;
  kind: ErrorKind;
  severity: ErrorSeverity;
  status: number | null;
  code: string | null;
  message: string;
  stack: string | null;
  method: string | null;
  path: string | null;
  pageUrl: string | null;
  requestId: string | null;
  userId: string | null;
  userRole: string | null;
  panel: string | null;
  platform: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  appVersion: string | null;
  context: Record<string, unknown> | null;
  fingerprint: string;
  resolvedAt: string | null;
  createdAt: string;
  user: ErrorUser | null;
}

export interface ErrorGroup {
  fingerprint: string;
  source: ErrorSource;
  kind: ErrorKind;
  severity: ErrorSeverity;
  status: number | null;
  code: string | null;
  message: string;
  method: string | null;
  path: string | null;
  pageUrl: string | null;
  count: number;
  users: number;
  openCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ErrorSummary {
  last24h: number;
  last24hErrors: number;
  openTotal: number;
  affectedUsers24h: number;
  bySource: Array<{ source: ErrorSource; count: number }>;
  byKind: Array<{ kind: ErrorKind; count: number }>;
  daily: Array<{ day: string; total: number; errors: number }>;
}

export interface ErrorFilters {
  source?: ErrorSource | '';
  severity?: ErrorSeverity | '';
  panel?: string;
  platform?: string;
  state?: 'open' | 'resolved' | '';
  q?: string;
  accountNumber?: string;
  fingerprint?: string;
}

export interface ErrorPage {
  items: ErrorLogItem[];
  total: number;
  page: number;
  limit: number;
}
