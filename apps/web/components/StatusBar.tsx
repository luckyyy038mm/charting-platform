'use client';

import { useMarketDataStore, useConnectionStore } from '@/stores/chartStore';
import type { ConnectionStatus } from '@/stores/chartStore';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
}

export function StatusBar({ connectionStatus }: StatusBarProps) {
  const { symbol, timeframe, candles, lastUpdate } = useMarketDataStore();
  const { subscribedSymbols } = useConnectionStore();

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-bull';
      case 'connecting':
      case 'reconnecting':
        return 'bg-status-warning';
      case 'disconnected':
        return 'bg-bear';
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  return (
    <footer className="h-6 bg-background-secondary border-t border-border flex items-center px-4 text-2xs gap-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor(connectionStatus)}`} />
        <span className="text-text-secondary">{getStatusText(connectionStatus)}</span>
      </div>

      {/* Current Symbol & Timeframe */}
      <div className="flex items-center gap-2 text-text-muted">
        <span>{symbol}</span>
        <span>|</span>
        <span>{timeframe.toUpperCase()}</span>
      </div>

      {/* Candle Count */}
      <div className="text-text-muted">
        {candles.length} candles
      </div>

      {/* Last Update Time */}
      <div className="flex-1" />
      
      {lastUpdate > 0 && (
        <div className="text-text-muted">
          Last update: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}

      {/* Subscribed Symbols */}
      {subscribedSymbols.length > 0 && (
        <div className="text-text-muted">
          Subscribed: {subscribedSymbols.join(', ')}
        </div>
      )}

      {/* Version */}
      <div className="text-text-muted">
        v0.1.0
      </div>
    </footer>
  );
}
