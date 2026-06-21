'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useConnectionStore, useMarketDataStore, Candle } from '@/stores/chartStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

interface KlineData {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed: boolean;
}

interface WSMessage {
  type: string;
  channel?: string;
  symbol?: string;
  data?: unknown;
}

export function useMarketWebSocket(onKlineUpdate?: (kline: KlineData) => void, onTradeUpdate?: (trade: { trade_id: string; price: number; quantity: number; time: number; is_buyer_maker: boolean }) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    status,
    setStatus,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    addSubscription,
  } = useConnectionStore();
  
  const { symbol, updateLastCandle, addCandle, addTrade } = useMarketDataStore();

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          console.log('WebSocket connected');
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
          if (onKlineUpdate && message.data) {
            const kline = message.data as KlineData;
            onKlineUpdate(kline);
          }
          break;
          
        case 'trade':
          if (message.data) {
            const trade = message.data as { trade_id: string; price: number; quantity: number; time: number; is_buyer_maker: boolean };
            if (onTradeUpdate) {
              onTradeUpdate(trade);
            }
            addTrade({
              id: parseInt(trade.trade_id) || Date.now(),
              price: trade.price,
              quantity: trade.quantity,
              time: trade.time,
              isBuyerMaker: trade.is_buyer_maker,
            });
          }
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
  }, [setStatus, resetReconnectAttempts, addSubscription, onKlineUpdate, onTradeUpdate, addTrade]);

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
  }, [connect, incrementReconnectAttempts, setStatus]);

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

  const ping = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'ping',
    }));
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Subscribe when symbol changes
  useEffect(() => {
    if (status === 'connected') {
      subscribe(symbol);
    }
  }, [symbol, status, subscribe]);

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
