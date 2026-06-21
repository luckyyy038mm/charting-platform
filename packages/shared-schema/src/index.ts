/**
 * Shared Market Event Schema
 * 
 * This package defines the normalized market event types that flow through
 * the entire platform - from Rust market services to Go API to TypeScript frontend.
 * 
 * All market events use a consistent format to ensure type safety across
 * the system boundaries.
 */

// =============================================================================
// Market Event Types
// =============================================================================

export type MarketEventType = 
  | 'trade'
  | 'kline'
  | 'depth_snapshot'
  | 'depth_update'
  | 'ticker'
  | 'market_status';

// =============================================================================
// Trade Event
// =============================================================================

export interface TradeEvent {
  type: 'trade';
  trade_id: string;
  symbol: string;
  price: number;
  quantity: number;
  quote_volume: number;
  is_buyer_maker: boolean;
  timestamp: number;
  exchange: string;
}

// =============================================================================
// Kline/Candlestick Event
// =============================================================================

export interface KlineEvent {
  type: 'kline';
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quote_volume: number;
  trades_count: number;
  open_time: number;
  close_time: number;
  is_closed: boolean;
  timestamp: number;
  exchange: string;
}

// =============================================================================
// Depth/Order Book Events
// =============================================================================

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface DepthSnapshotEvent {
  type: 'depth_snapshot';
  symbol: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  last_update_id: number;
  timestamp: number;
  exchange: string;
}

export interface DepthUpdateEvent {
  type: 'depth_update';
  symbol: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  last_update_id: number;
  timestamp: number;
  exchange: string;
}

// =============================================================================
// Ticker Event
// =============================================================================

export interface TickerEvent {
  type: 'ticker';
  symbol: string;
  price_change: number;
  price_change_percent: number;
  last_price: number;
  high_price: number;
  low_price: number;
  volume: number;
  quote_volume: number;
  timestamp: number;
  exchange: string;
}

// =============================================================================
// Market Status Event
// =============================================================================

export interface MarketStatusEvent {
  type: 'market_status';
  symbol: string | null;
  status: 'connected' | 'disconnected' | 'started' | 'stopped' | 'error';
  message: string;
  timestamp: number;
  exchange: string;
}

// =============================================================================
// Union Type for All Market Events
// =============================================================================

export type MarketEvent = 
  | TradeEvent
  | KlineEvent
  | DepthSnapshotEvent
  | DepthUpdateEvent
  | TickerEvent
  | MarketStatusEvent;

// =============================================================================
// WebSocket Message Types
// =============================================================================

export interface WSMessage {
  type: WSMessageType;
  channel?: string;
  symbol?: string;
  data?: unknown;
}

export type WSMessageType = 
  | 'subscribe'
  | 'unsubscribe'
  | 'subscribed'
  | 'unsubscribed'
  | 'connected'
  | 'disconnected'
  | 'ping'
  | 'pong'
  | 'error'
  | 'trade'
  | 'kline'
  | 'depth'
  | 'ticker'
  | 'status';

export interface WSSubscribeMessage {
  type: 'subscribe';
  channel: 'market';
  symbol: string;
}

export interface WSUnsubscribeMessage {
  type: 'unsubscribe';
  channel: 'market';
  symbol: string;
}

export interface WSResponse {
  type: WSMessageType;
  channel: string;
  symbol?: string;
  data?: unknown;
}

// =============================================================================
// Snapshot Types
// =============================================================================

export interface SymbolSnapshot {
  symbol: string;
  last_price: number;
  best_bid: DepthLevel | null;
  best_ask: DepthLevel | null;
  timestamp: number;
}

// =============================================================================
// Symbol Types
// =============================================================================

export interface Symbol {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  exchange: string;
  contract_type: 'perpetual' | 'delivery' | 'future';
  tick_size: number;
  lot_size: number;
  min_quantity: number;
  max_quantity: number;
  is_active: boolean;
}

// =============================================================================
// Chart Data Types
// =============================================================================

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

// =============================================================================
// Timeframe Types
// =============================================================================

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1m': '1 Minute',
  '5m': '5 Minutes',
  '15m': '15 Minutes',
  '1h': '1 Hour',
  '4h': '4 Hours',
  '1d': '1 Day',
  '1w': '1 Week',
  '1M': '1 Month',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the event type from a market event
 */
export function getEventType(event: MarketEvent): MarketEventType {
  return event.type;
}

/**
 * Get the symbol from a market event
 */
export function getEventSymbol(event: MarketEvent): string {
  return event.symbol;
}

/**
 * Check if an event is a specific type
 */
export function isTradeEvent(event: MarketEvent): event is TradeEvent {
  return event.type === 'trade';
}

export function isKlineEvent(event: MarketEvent): event is KlineEvent {
  return event.type === 'kline';
}

export function isDepthEvent(event: MarketEvent): event is DepthUpdateEvent | DepthSnapshotEvent {
  return event.type === 'depth_update' || event.type === 'depth_snapshot';
}

export function isTickerEvent(event: MarketEvent): event is TickerEvent {
  return event.type === 'ticker';
}

export function isMarketStatusEvent(event: MarketEvent): event is MarketStatusEvent {
  return event.type === 'market_status';
}

/**
 * Convert kline event to candle for chart rendering
 */
export function klineToCandle(kline: KlineEvent): Candle {
  return {
    time: kline.open_time,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
    volume: kline.volume,
  };
}

/**
 * Format price based on symbol tick size
 */
export function formatPrice(price: number, tickSize: number = 0.01): string {
  const decimals = Math.max(0, -Math.floor(Math.log10(tickSize)));
  return price.toFixed(decimals);
}

/**
 * Format volume
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return (volume / 1_000_000_000).toFixed(2) + 'B';
  }
  if (volume >= 1_000_000) {
    return (volume / 1_000_000).toFixed(2) + 'M';
  }
  if (volume >= 1_000) {
    return (volume / 1_000).toFixed(2) + 'K';
  }
  return volume.toFixed(2);
}
