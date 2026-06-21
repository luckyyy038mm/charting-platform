'use client';

import { useEffect } from 'react';
import { useMarketWebSocket } from '@/hooks/useMarketWebSocket';
import { ChartWorkspace } from '@/components/ChartWorkspace';
import { TopToolbar } from '@/components/TopToolbar';
import { StatusBar } from '@/components/StatusBar';

export default function ChartPage() {
  const { status } = useMarketWebSocket();

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top Toolbar */}
      <TopToolbar />
      
      {/* Main Chart Area */}
      <main className="flex-1 flex min-h-0">
        {/* Left Sidebar - Future DOM/Ladder placeholder */}
        <aside className="w-12 bg-background-secondary border-r border-border flex flex-col items-center py-2">
          <div className="text-2xs text-text-muted uppercase tracking-wider mb-2">Tools</div>
          <div className="flex-1 flex flex-col gap-1">
            <ToolButton icon="◉" label="Cursor" />
            <ToolButton icon="—" label="Line" />
            <ToolButton icon="▭" label="Rect" />
            <ToolButton icon="↗" label="Trend" />
            <div className="border-t border-border my-2" />
            <ToolButton icon="☰" label="Menu" />
          </div>
        </aside>

        {/* Chart Workspace */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChartWorkspace />
        </div>

        {/* Right Panel - Future order book / trades placeholder */}
        <aside className="w-64 bg-background-secondary border-l border-border flex flex-col">
          <div className="px-3 py-2 border-b border-border">
            <h2 className="text-sm font-medium text-text-primary">Order Book</h2>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <OrderBookPlaceholder />
          </div>
          <div className="border-t border-border">
            <div className="px-3 py-2">
              <h2 className="text-sm font-medium text-text-primary mb-2">Recent Trades</h2>
            </div>
            <div className="max-h-48 overflow-auto">
              <TradesPlaceholder />
            </div>
          </div>
        </aside>
      </main>

      {/* Status Bar */}
      <StatusBar connectionStatus={status} />
    </div>
  );
}

function ToolButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded transition-colors"
      title={label}
    >
      <span className="text-lg">{icon}</span>
    </button>
  );
}

function OrderBookPlaceholder() {
  return (
    <div className="text-2xs text-text-muted">
      <div className="flex justify-between text-bull mb-1">
        <span>50,234.50</span>
        <span>1.234</span>
      </div>
      <div className="w-full bg-bull/20 h-1 rounded" style={{ width: '45%' }} />
      <div className="flex justify-between text-text-muted my-1">
        <span>50,234.00</span>
        <span>Spread: 0.50</span>
      </div>
      <div className="w-full bg-bear/20 h-1 rounded" style={{ width: '30%' }} />
      <div className="flex justify-between text-bear mb-1 mt-1">
        <span>50,233.50</span>
        <span>0.876</span>
      </div>
      <p className="mt-4 text-center">Order book will be implemented in Phase 2</p>
    </div>
  );
}

function TradesPlaceholder() {
  const trades = [
    { price: 50234.50, qty: 0.123, side: 'sell' as const, time: '12:34:56' },
    { price: 50234.25, qty: 0.456, side: 'buy' as const, time: '12:34:55' },
    { price: 50234.00, qty: 0.789, side: 'sell' as const, time: '12:34:54' },
    { price: 50233.75, qty: 0.234, side: 'buy' as const, time: '12:34:53' },
    { price: 50233.50, qty: 0.567, side: 'sell' as const, time: '12:34:52' },
  ];

  return (
    <div className="space-y-0.5 text-2xs">
      {trades.map((trade, i) => (
        <div key={i} className="flex justify-between items-center px-2 py-0.5 hover:bg-surface-elevated rounded">
          <span className={trade.side === 'buy' ? 'text-bull' : 'text-bear'}>
            {trade.price.toFixed(2)}
          </span>
          <span className="text-text-secondary">{trade.qty}</span>
          <span className="text-text-muted">{trade.time}</span>
        </div>
      ))}
      <p className="text-center text-text-muted mt-2">Time & Sales in Phase 2</p>
    </div>
  );
}
