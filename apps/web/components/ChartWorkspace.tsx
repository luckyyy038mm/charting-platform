'use client';

import { useRef, useEffect } from 'react';
import { useMarketDataStore, useChartUIStore, useChartModeStore } from '@/stores/chartStore';
import { ChartCanvas } from './ChartCanvas';

export function ChartWorkspace() {
  const { candles, symbol, timeframe, isLoading, error } = useMarketDataStore();
  const { showVolume, showPriceScale, showTimeScale } = useChartUIStore();
  const { mode } = useChartModeStore();

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Chart Header */}
      <div className="h-8 flex items-center px-4 border-b border-border bg-background-secondary">
        <span className="text-sm text-text-primary font-medium">
          {symbol}
        </span>
        <span className="text-xs text-text-muted ml-2">
          {timeframe.toUpperCase()}
        </span>
        <div className="flex-1" />
        {candles.length > 0 && (
          <div className="flex items-center gap-4 text-xs">
            <PriceInfo candles={candles} />
          </div>
        )}
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 relative min-h-0">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">Loading chart data...</span>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-status-error text-lg">⚠</span>
              <span className="text-sm text-text-secondary">{error}</span>
              <span className="text-xs text-text-muted">Connect to market data for live updates</span>
            </div>
          </div>
        ) : candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-4xl text-text-muted">📊</span>
              <span className="text-sm text-text-secondary">No chart data loaded</span>
              <span className="text-xs text-text-muted">
                Connect to {symbol} market data to see live candles
              </span>
            </div>
          </div>
        ) : (
          <ChartCanvas
            candles={candles}
            mode={mode}
            showVolume={showVolume}
            showPriceScale={showPriceScale}
            showTimeScale={showTimeScale}
          />
        )}
      </div>
    </div>
  );
}

function PriceInfo({ candles }: { candles: { open: number; high: number; low: number; close: number; volume: number }[] }) {
  if (candles.length === 0) return null;

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
  
  const priceChange = lastCandle.close - prevCandle.close;
  const priceChangePercent = (priceChange / prevCandle.close) * 100;
  const isBullish = priceChange >= 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-text-primary font-mono font-medium">
          {lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`text-xs font-mono ${isBullish ? 'text-bull' : 'text-bear'}`}>
          {isBullish ? '+' : ''}{priceChange.toFixed(2)} ({isBullish ? '+' : ''}{priceChangePercent.toFixed(2)}%)
        </span>
      </div>
      <div className="flex items-center gap-3 text-text-muted">
        <span>H: <span className="text-text-secondary font-mono">{lastCandle.high.toLocaleString()}</span></span>
        <span>L: <span className="text-text-secondary font-mono">{lastCandle.low.toLocaleString()}</span></span>
        <span>V: <span className="text-text-secondary font-mono">{formatVolume(lastCandle.volume)}</span></span>
      </div>
    </>
  );
}

function formatVolume(volume: number): string {
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
