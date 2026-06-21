'use client';

import { useEffect, useCallback, useRef } from 'react';
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

// Generate mock candles for demo purposes
function generateMockCandles(symbol: string, timeframe: string, count: number): Candle[] {
  const now = Date.now();
  const intervalMs = getIntervalMs(timeframe);
  
  // Base price varies by symbol
  const basePrice = symbol === 'BTCUSDT' ? 65000 : 3500;
  
  const candles: Candle[] = [];
  let currentPrice = basePrice;
  
  for (let i = count - 1; i >= 0; i--) {
    const openTime = now - (i * intervalMs);
    const volatility = basePrice * 0.002; // 0.2% volatility
    
    // Random walk
    const change = (Math.random() - 0.5) * volatility * 2;
    const open = currentPrice;
    const close = open + change;
    
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = Math.random() * 100 + 10;
    
    candles.push({
      time: openTime,
      open,
      high,
      low,
      close,
      volume,
    });
    
    currentPrice = close;
  }
  
  return candles;
}

// Generate mock trades
function generateMockTrades(symbol: string, count: number): Trade[] {
  const basePrice = symbol === 'BTCUSDT' ? 65000 : 3500;
  const trades: Trade[] = [];
  
  for (let i = 0; i < count; i++) {
    const price = basePrice + (Math.random() - 0.5) * basePrice * 0.001;
    trades.push({
      id: Date.now() - i * 100,
      price,
      quantity: Math.random() * 2 + 0.1,
      time: Date.now() - i * 1000,
      isBuyerMaker: Math.random() > 0.5,
    });
  }
  
  return trades;
}

// Generate mock order book
function generateMockOrderBook(symbol: string): OrderBook {
  const midPrice = symbol === 'BTCUSDT' ? 65000 : 3500;
  const spread = midPrice * 0.0001;
  
  const bids = [];
  const asks = [];
  
  for (let i = 0; i < 10; i++) {
    bids.push({
      price: midPrice - spread * (i + 1),
      quantity: Math.random() * 10 + 1,
    });
    asks.push({
      price: midPrice + spread * (i + 1),
      quantity: Math.random() * 10 + 1,
    });
  }
  
  return {
    bestBid: bids[0].price,
    bestAsk: asks[0].price,
    spread: spread * 2,
    bids,
    asks,
  };
}

function getIntervalMs(timeframe: string): number {
  const intervals: Record<string, number> = {
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '1h': 3600000,
    '4h': 14400000,
    '1d': 86400000,
  };
  return intervals[timeframe] || 60000;
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
  
  const mockModeRef = useRef(false);
  const candleUpdateRef = useRef<NodeJS.Timeout | null>(null);

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
      mockModeRef.current = false;
    } catch (error) {
      console.warn('Failed to fetch candles from API, using mock data:', error);
      // Use mock data when API fails
      mockModeRef.current = true;
      const mockCandles = generateMockCandles(symbol, timeframe, 100);
      setCandles(mockCandles);
      setError(null);
    }
  }, [symbol, timeframe, setCandles, setLoading, setError]);

  // Fetch recent trades
  const fetchTrades = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/market/trades?symbol=${symbol}&limit=50`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch trades`);
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
      // Use mock data
      const mockTrades = generateMockTrades(symbol, 50);
      setTrades(mockTrades);
    }
  }, [symbol, setTrades]);

  // Fetch order book
  const fetchOrderBook = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/market/orderbook?symbol=${symbol}&limit=10`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch order book`);
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
      // Use mock data
      const mockOrderBook = generateMockOrderBook(symbol);
      setOrderBook(mockOrderBook);
    }
  }, [symbol, setOrderBook]);

  // Load all initial data when symbol or timeframe changes
  useEffect(() => {
    // Clear any existing intervals
    if (candleUpdateRef.current) {
      clearInterval(candleUpdateRef.current);
    }
    
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

  // Simulate live candle updates in mock mode
  useEffect(() => {
    if (mockModeRef.current && candles.length > 0) {
      candleUpdateRef.current = setInterval(() => {
        const lastCandle = candles[candles.length - 1];
        if (!lastCandle) return;
        
        const intervalMs = getIntervalMs(timeframe);
        const now = Date.now();
        
        if (now - lastCandle.time >= intervalMs) {
          // Start new candle
          const newCandle: Candle = {
            time: now - (now % intervalMs),
            open: lastCandle.close,
            high: lastCandle.close,
            low: lastCandle.close,
            close: lastCandle.close + (Math.random() - 0.5) * lastCandle.close * 0.001,
            volume: Math.random() * 10,
          };
          addCandle(newCandle);
        } else {
          // Update current candle
          const priceChange = (Math.random() - 0.5) * lastCandle.close * 0.0005;
          const newClose = lastCandle.close + priceChange;
          
          const updatedCandle: Candle = {
            ...lastCandle,
            high: Math.max(lastCandle.high, newClose),
            low: Math.min(lastCandle.low, newClose),
            close: newClose,
            volume: lastCandle.volume + Math.random() * 0.5,
          };
          updateLastCandle(updatedCandle);
        }
        
        // Add mock trade
        const mockTrade: Trade = {
          id: Date.now(),
          price: lastCandle.close + (Math.random() - 0.5) * 10,
          quantity: Math.random() * 2,
          time: Date.now(),
          isBuyerMaker: Math.random() > 0.5,
        };
        addTrade(mockTrade);
        
        // Update order book
        fetchOrderBook();
      }, 500);
      
      return () => {
        if (candleUpdateRef.current) {
          clearInterval(candleUpdateRef.current);
        }
      };
    }
  }, [mockModeRef.current, candles.length, timeframe, addCandle, updateLastCandle, addTrade, fetchOrderBook]);

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
    if (mockModeRef.current) return; // Don't process real updates in mock mode
    
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
    if (mockModeRef.current) return; // Don't process real updates in mock mode
    
    const newTrade: Trade = {
      id: parseInt(trade.trade_id) || Date.now(),
      price: trade.price,
      quantity: trade.quantity,
      time: trade.time,
      isBuyerMaker: trade.is_buyer_maker,
    };
    addTrade(newTrade);
  }, [addTrade]);

  return {
    candles,
    fetchCandles,
    fetchTrades,
    fetchOrderBook,
    handleKlineUpdate,
    handleTradeUpdate,
  };
}
