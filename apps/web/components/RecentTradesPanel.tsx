'use client';

import { useMarketDataStore, Trade } from '@/stores/chartStore';

export function RecentTradesPanel() {
  const { trades } = useMarketDataStore();

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Loading trades...
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 px-2 py-1 text-2xs text-text-muted border-b border-border">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      
      {/* Trade rows */}
      <div className="overflow-auto h-[calc(100%-28px)]">
        {trades.map((trade: Trade) => (
          <div
            key={trade.id}
            className="grid grid-cols-3 gap-2 px-2 py-1 text-2xs hover:bg-surface-elevated transition-colors"
          >
            <span className={trade.isBuyerMaker ? 'text-bear' : 'text-bull'}>
              {trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-right text-text-secondary">
              {trade.quantity.toFixed(4)}
            </span>
            <span className="text-right text-text-muted">
              {formatTime(trade.time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
}
