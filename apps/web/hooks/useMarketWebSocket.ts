'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useConnectionStore, useMarketDataStore } from '@/stores/chartStore';
import type { MarketEvent, KlineEvent, TradeEvent, Candle } from '@charting-platform/market-types';

/**
 * WebSocket connection URL from environment
 */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

/**
 * Reconnection delay in milliseconds
 */
const RECONNECT_DELAY = 3000;

/**
 * Maximum reconnection attempts
 */
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Hook for managing WebSocket connection to the market data service
 */
export function useMarketWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    status,
    setStatus,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    addSubscription,
  } = useConnectionStore();
  
  const { symbol, timeframe, updateLastCandle, addCandle } = useMarketDataStore();

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          console.log('WebSocket connected:', message.data);
          setStatus('connected');
          resetReconnectAttempts();
          break;
          
        case 'subscribed':
          console.log('Subscribed to:', message.symbol);
          if (message.symbol) {
            addSubscription(message.symbol);
          }
          break;
          
        case 'kline':
          handleKlineEvent(message.data as KlineEvent);
          break;
          
        case 'trade':
          handleTradeEvent(message.data as TradeEvent);
          break;
          
        case 'pong':
          break;
          
        case 'error':
          console.error('WebSocket error:', message.data);
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [setStatus, resetReconnectAttempts, addSubscription]);

  /**
   * Handle kline events
   */
  const handleKlineEvent = useCallback((kline: KlineEvent) => {
    const candle: Candle = {
      time: kline.open_time,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume,
    };

    if (kline.is_closed) {
      addCandle(candle);
    } else {
      updateLastCandle(candle);
    }
  }, [addCandle, updateLastCandle]);

  /**
   * Handle trade events
   */
  const handleTradeEvent = useCallback((_trade: TradeEvent) => {
    // Trade events can be used for time & sales, tape, etc.
    // Future: aggregate and display
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');

    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('connected');
        resetReconnectAttempts();
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        wsRef.current = null;

        if (!event.wasClean) {
          setStatus('reconnecting');
          scheduleReconnect();
        } else {
          setStatus('disconnected');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setStatus('disconnected');
      scheduleReconnect();
    }
  }, [setStatus, resetReconnectAttempts, handleMessage]);

  /**
   * Schedule reconnection attempt
   */
  const scheduleReconnect = useCallback(() => {
    const { reconnectAttempts } = useConnectionStore.getState();
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      setStatus('disconnected');
      return;
    }

    incrementReconnectAttempts();
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY);
  }, [connect, incrementReconnectAttempts]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnected');
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, [setStatus]);

  /**
   * Subscribe to market data for a symbol
   */
  const subscribe = useCallback((sym: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot subscribe');
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      channel: 'market',
      symbol: sym.toLowerCase(),
    }));
  }, []);

  /**
   * Unsubscribe from market data for a symbol
   */
  const unsubscribe = useCallback((sym: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'unsubscribe',
      channel: 'market',
      symbol: sym.toLowerCase(),
    }));
  }, []);

  /**
   * Send ping to server
   */
  const ping = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'ping',
    }));
  }, []);

  // Auto-connect and subscribe on mount
  useEffect(() => {
    connect();
    
    // Subscribe to current symbol
    const unsubscribeFromStore = useConnectionStore.subscribe((state) => {
      if (state.status === 'connected' && !state.subscribedSymbols.includes(symbol)) {
        subscribe(symbol);
      }
    });

    return () => {
      unsubscribeFromStore();
      disconnect();
    };
  }, []);

  // Re-subscribe when symbol changes
  useEffect(() => {
    if (status === 'connected') {
      subscribe(symbol);
    }
  }, [symbol, timeframe, status, subscribe]);

  // Periodic ping
  useEffect(() => {
    const pingInterval = setInterval(ping, 30000);
    return () => clearInterval(pingInterval);
  }, [ping]);

  return {
    status,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    ping,
  };
}
