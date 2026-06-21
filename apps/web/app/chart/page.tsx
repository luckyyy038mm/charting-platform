'use client';

import { useMarketDataStore, useConnectionStore } from '@/stores/chartStore';
import { useChartData } from '@/hooks/useChartData';
import { useMarketWebSocket } from '@/hooks/useMarketWebSocket';
import { ChartWorkspace } from '@/components/ChartWorkspace';
import { TopToolbar } from '@/components/TopToolbar';
import { StatusBar } from '@/components/StatusBar';
import { RecentTradesPanel } from '@/components/RecentTradesPanel';
import { OrderBookPanel } from '@/components/OrderBookPanel';

export default function ChartPage() {
  const { status } = useConnectionStore();
  
  // Load chart data and handle live updates
  const { handleKlineUpdate, handleTradeUpdate } = useChartData();
  
  // Connect to WebSocket with live update handlers
  useMarketWebSocket(handleKlineUpdate, handleTradeUpdate);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top Toolbar */}
      <TopToolbar />
      
      {/* Main Chart Area */}
      <main className="flex-1 flex min-h-0">
        {/* Left Sidebar - Tools placeholder */}
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

        {/* Right Panel - Order Book and Recent Trades */}
        <aside className="w-72 bg-background-secondary border-l border-border flex flex-col">
          {/* Order Book */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-border">
            <div className="px-3 py-2 border-b border-border shrink-0">
              <h2 className="text-sm font-medium text-text-primary">Order Book</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <OrderBookPanel />
            </div>
          </div>
          
          {/* Recent Trades */}
          <div className="h-64 flex flex-col shrink-0">
            <div className="px-3 py-2 border-b border-border">
              <h2 className="text-sm font-medium text-text-primary">Recent Trades</h2>
            </div>
            <div className="flex-1 overflow-auto">
              <RecentTradesPanel />
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
