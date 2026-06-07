/**
 * Shared TypeScript interfaces for Segnals API responses.
 *
 * These types reflect the data shapes returned by the Segnals REST API.
 * They are used by tool implementations to provide structured output.
 */

/** User profile from GET /api/auth/me */
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  tier: string;
  is_admin: boolean;
  is_frozen: boolean;
  subscription_ends_at: string | null;
  trial_expires_at: string | null;
  language: string;
  has_completed_onboarding: boolean;
}

/** Bot summary from GET /api/bots/ */
export interface BotSummary {
  id: number;
  name: string;
  exchange: string;
  status: string;
  symbol?: string;
  timeframe?: string;
  created_at?: string;
}

/** Bot detail from GET /api/bots/<id> */
export interface BotDetail extends BotSummary {
  config: Record<string, unknown>;
  user_id: number;
}

/** Trade record from GET /api/bots/trades */
export interface TradeRecord {
  id: number;
  bot_id: number;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  pnl?: number;
  opened_at: string;
  closed_at?: string;
}

/** Dashboard summary from GET /api/bots/dashboard */
export interface DashboardData {
  total_pnl: number;
  win_rate: number;
  active_bots: number;
  total_bots: number;
  total_trades: number;
  [key: string]: unknown;
}

/** Bot performance from GET /api/bots/<id>/performance */
export interface BotPerformance {
  net_pnl: number;
  win_rate: number;
  total_trades: number;
  drawdown?: number;
  [key: string]: unknown;
}

/** Marketplace listing summary */
export interface MarketplaceListing {
  id: string | number;
  name: string;
  description?: string;
  exchange: string;
  symbol?: string;
  price?: number;
  performance?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Connection status (booleans only — no secrets) */
export interface ConnectionStatus {
  mt5: boolean;
  bybit: boolean;
  phemex: boolean;
  telegram: boolean;
}

/** Copy trading status from GET /api/copy-trading/ */
export interface CopyTradingStatus {
  [key: string]: unknown;
}

/** Notification preferences from GET /api/user/notification-preferences */
export interface NotificationPreferences {
  system_reminders?: boolean;
  daily_report?: { enabled: boolean; hour_utc: number };
  performance_alerts?: { enabled: boolean; threshold_pnl_usd: number };
  weekly_summary?: { enabled: boolean; day: string; hour_utc: number };
  [key: string]: unknown;
}
