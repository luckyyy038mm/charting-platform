'use client';

import { useCallback } from 'react';
import { useMarketDataStore } from '@/stores/chartStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

interface CandlesResponse {
  symbol: string;
  timeframe: string;
  candles: CandleData[];
  count: number;
}

interface TradeData {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
}

interface TradesResponse {
  symbol: string;
  trades: TradeData[];
  count: number;
}

interface OrderBookData {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export function useMarketApi() {
  const { setCandles, setLoading, setError, setSymbol, setTimeframe } = useMarketDataStore();

  const fetchCandles = useCallback(async (symbol: string, timeframe: string, limit = 100) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/market/candles?symbol=${symbol}&interval=${timeframe}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch candles: ${response.statusText}`);
      }

      const data: CandlesResponse = await response.json();
      
      const candles = data.candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      setCandles(candles);
      return candles;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch candles';
      setError(message);
      console.error('Failed to fetch candles:', error);
      return [];
    }
  }, [setCandles, setLoading, setError]);

  const fetchTrades = useCallback(async (symbol: string, limit = 50): Promise<TradeData[]> => {
    try {
      const response = await fetch(
        `${API_URL}/api/market/trades?symbol=${symbol}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch trades: ${response.statusText}`);
      }

      const data: TradesResponse = await response.json();
      return data.trades;
    } catch (error) {
      console.error('Failed to fetch trades:', error);
      return [];
    }
  }, []);

  const fetchOrderBook = useCallback(async (symbol: string, limit = 10): Promise<OrderBookData | null> => {
    try {
      const response = await fetch(
        `${API_URL}/api/market/orderbook?symbol=${symbol}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.statusText}`);
      }

      const data: OrderBookData = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch order book:', error);
      return null;
    }
  }, []);

  return {
    fetchCandles,
    fetchTrades,
    fetchOrderBook,
  };
}
