'use client';

import { useEffect, useCallback } from 'react';
import { useMarketDataStore, Candle, Trade, OrderBook } from '@/stores/chartStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface BinanceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

interface BinanceTrade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
}

export function useChartData() {
  const {
    symbol,
    timeframe,
    candles,
    setCandles,
    updateLastCandle,
    addCandle,
    setTrades,
    addTrade,
    setOrderBook,
    setLoading,
    setError,
  } = useMarketDataStore();

  // Fetch historical candles
  const fetchCandles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/market/candles?symbol=${symbol}&interval=${timeframe}&limit=200`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch candles: ${response.statusText}`);
      }

      const data = await response.json();
      
      const parsedCandles: Candle[] = data.candles.map((c: BinanceCandle) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      setCandles(parsedCandles);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch candles';
      setError(message);
      console.error('Failed to fetch candles:', error);
    }
  }, [symbol, timeframe, setCandles, setLoading, setError]);

  // Fetch recent trades
  const fetchTrades = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/market/trades?symbol=${symbol}&limit=50`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch trades: ${response.statusText}`);
      }

      const data = await response.json();
      
      const parsedTrades: Trade[] = data.trades.map((t: BinanceTrade) => ({
        id: t.id,
        price: parseFloat(t.price),
        quantity: parseFloat(t.qty),
        time: t.time,
        isBuyerMaker: t.isBuyerMaker,
      }));

      setTrades(parsedTrades);
    } catch (error) {
      console.error('Failed to fetch trades:', error);
    }
  }, [symbol, setTrades]);

  // Fetch order book
  const fetchOrderBook = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/market/orderbook?symbol=${symbol}&limit=10`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.statusText}`);
      }

      const data = await response.json();

      const bids = data.bids.map((b: [string, string]) => ({
        price: parseFloat(b[0]),
        quantity: parseFloat(b[1]),
      }));

      const asks = data.asks.map((a: [string, string]) => ({
        price: parseFloat(a[0]),
        quantity: parseFloat(a[1]),
      }));

      const orderBook: OrderBook = {
        bestBid: bids[0]?.price || 0,
        bestAsk: asks[0]?.price || 0,
        spread: asks[0]?.price && bids[0]?.price ? asks[0].price - bids[0].price : 0,
        bids,
        asks,
      };

      setOrderBook(orderBook);
    } catch (error) {
      console.error('Failed to fetch order book:', error);
    }
  }, [symbol, setOrderBook]);

  // Load all initial data when symbol or timeframe changes
  useEffect(() => {
    fetchCandles();
    fetchTrades();
    fetchOrderBook();

    // Set up polling for trades and order book
    const interval = setInterval(() => {
      fetchTrades();
      fetchOrderBook();
    }, 2000);

    return () => clearInterval(interval);
  }, [symbol, timeframe, fetchCandles, fetchTrades, fetchOrderBook]);

  // Handle live kline update from WebSocket
  const handleKlineUpdate = useCallback((kline: {
    open_time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    is_closed: boolean;
  }) => {
    const newCandle: Candle = {
      time: kline.open_time,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume,
    };

    if (kline.is_closed) {
      addCandle(newCandle);
    } else {
      updateLastCandle(newCandle);
    }
  }, [addCandle, updateLastCandle]);

  // Handle live trade update
  const handleTradeUpdate = useCallback((trade: {
    trade_id: string;
    price: number;
    quantity: number;
    time: number;
    is_buyer_maker: boolean;
  }) => {
    const newTrade: Trade = {
      id: parseInt(trade.trade_id) || Date.now(),
      price: trade.price,
      quantity: trade.quantity,
      time: trade.time,
      isBuyerMaker: trade.is_buyer_maker,
    };
    addTrade(newTrade);
  }, [addTrade]);

  // Handle live order book update
  const handleDepthUpdate = useCallback((depth: {
    bids: [string, string][];
    asks: [string, string][];
  }) => {
    const bids = depth.bids.map((b) => ({
      price: parseFloat(b[0]),
      quantity: parseFloat(b[1]),
    }));

    const asks = depth.asks.map((a) => ({
      price: parseFloat(a[0]),
      quantity: parseFloat(a[1]),
    }));

    const orderBook: OrderBook = {
      bestBid: bids[0]?.price || 0,
      bestAsk: asks[0]?.price || 0,
      spread: asks[0]?.price && bids[0]?.price ? asks[0].price - bids[0].price : 0,
      bids,
      asks,
    };

    setOrderBook(orderBook);
  }, [setOrderBook]);

  return {
    candles,
    fetchCandles,
    fetchTrades,
    fetchOrderBook,
    handleKlineUpdate,
    handleTradeUpdate,
    handleDepthUpdate,
  };
}
