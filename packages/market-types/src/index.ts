/**
 * Market Types Package
 * 
 * This package provides TypeScript types for market data consumed by the frontend.
 * It re-exports types from shared-schema and adds frontend-specific market types.
 */

// Re-export all shared schema types
export {
  type MarketEvent,
  type MarketEventType,
  type TradeEvent,
  type KlineEvent,
  type DepthLevel,
  type DepthSnapshotEvent,
  type DepthUpdateEvent,
  type TickerEvent,
  type MarketStatusEvent,
  type WSMessage,
  type WSMessageType,
  type WSSubscribeMessage,
  type WSUnsubscribeMessage,
  type WSResponse,
  type SymbolSnapshot,
  type Symbol,
  type Candle,
  type OHLC,
  type Timeframe,
  TIMEFRAMES,
  TIMEFRAME_LABELS,
  getEventType,
  getEventSymbol,
  isTradeEvent,
  isKlineEvent,
  isDepthEvent,
  isTickerEvent,
  isMarketStatusEvent,
  klineToCandle,
  formatPrice,
  formatVolume,
} from '@charting-platform/shared-schema';

// =============================================================================
// Frontend-Specific Market Types
// =============================================================================

/**
 * Connection state for WebSocket connections
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/**
 * Chart data state for the frontend
 */
export interface ChartDataState {
  candles: Candle[];
  lastUpdate: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Market subscription state
 */
export interface SubscriptionState {
  symbol: string;
  timeframe: Timeframe;
  isSubscribed: boolean;
  lastEvent: number;
}

/**
 * Order book aggregation for display
 */
export interface OrderBookState {
  symbol: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  lastUpdateId: number;
  timestamp: number;
}

export interface PriceLevel {
  price: number;
  quantity: number;
  total: number;
  percentage: number;
}

/**
 * Trade aggregation for time & sales display
 */
export interface TradesState {
  symbol: string;
  trades: AggressiveTrade[];
  lastUpdate: number;
}

export interface AggressiveTrade {
  id: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

/**
 * Ticker display state
 */
export interface TickerState {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  timestamp: number;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SystemStatusResponse {
  service: string;
  version: string;
  status: string;
  uptime: string;
  features: Record<string, boolean | string>;
}

export interface SymbolListResponse {
  symbols: Symbol[];
  count: number;
}

// =============================================================================
// Event Helpers
// =============================================================================

/**
 * Create a ticker state from a ticker event
 */
export function tickerFromEvent(event: TickerEvent): TickerState {
  return {
    symbol: event.symbol,
    lastPrice: event.last_price,
    priceChange: event.price_change,
    priceChangePercent: event.price_change_percent,
    high24h: event.high_price,
    low24h: event.low_price,
    volume24h: event.volume,
    quoteVolume24h: event.quote_volume,
    timestamp: event.timestamp,
  };
}

/**
 * Create an aggressive trade from a trade event
 */
export function aggressiveTradeFromEvent(event: TradeEvent): AggressiveTrade {
  return {
    id: event.trade_id,
    price: event.price,
    quantity: event.quantity,
    side: event.is_buyer_maker ? 'sell' : 'buy',
    timestamp: event.timestamp,
  };
}

/**
 * Calculate order book aggregation with cumulative totals
 */
export function calculateOrderBook(
  bids: DepthLevel[],
  asks: DepthLevel[],
  maxLevels: number = 20
): OrderBookState {
  const processLevels = (
    levels: DepthLevel[],
    ascending: boolean
  ): PriceLevel[] => {
    let cumulative = 0;
    const processed = levels
      .slice(0, maxLevels)
      .map((level) => {
        cumulative += level.quantity;
        return {
          price: level.price,
          quantity: level.quantity,
          total: cumulative,
          percentage: 0, // Will be calculated after
        };
      });

    // Calculate max total for percentage
    const maxTotal = Math.max(...processed.map((p) => p.total));
    return processed.map((p) => ({
      ...p,
      percentage: maxTotal > 0 ? (p.total / maxTotal) * 100 : 0,
    }));
  };

  const processedBids = processLevels(bids, false);
  const processedAsks = processLevels(asks, true);

  // Calculate asks percentages (reverse for display)
  const maxTotal = Math.max(
    ...processedBids.map((p) => p.total),
    ...processedAsks.map((p) => p.total)
  );

  return {
    symbol: '',
    bids: processedBids.map((p) => ({
      ...p,
      percentage: maxTotal > 0 ? (p.total / maxTotal) * 100 : 0,
    })),
    asks: processedAsks.map((p) => ({
      ...p,
      percentage: maxTotal > 0 ? (p.total / maxTotal) * 100 : 0,
    })),
    lastUpdateId: 0,
    timestamp: Date.now(),
  };
}
