'use client';

import { useMarketDataStore, useChartModeStore } from '@/stores/chartStore';

export function TopToolbar() {
  const { symbol, timeframe, setSymbol, setTimeframe } = useMarketDataStore();
  const { mode, setMode } = useChartModeStore();

  const symbols = ['BTCUSDT', 'ETHUSDT'];
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
  const modes = [
    { id: 'candlestick', label: 'Candles' },
    { id: 'line', label: 'Line' },
    { id: 'area', label: 'Area' },
  ] as const;

  return (
    <header className="h-12 bg-background-secondary border-b border-border flex items-center px-4 gap-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">CP</span>
        </div>
        <span className="text-text-primary font-semibold hidden sm:block">Charting Platform</span>
      </div>

      {/* Symbol Selector */}
      <div className="flex items-center gap-2">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-surface-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          {symbols.map((sym) => (
            <option key={sym} value={sym}>
              {sym}
            </option>
          ))}
        </select>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center gap-1 bg-surface rounded p-0.5">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              timeframe === tf
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Chart Mode Selector */}
      <div className="flex items-center gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              mode === m.id
                ? 'bg-surface-elevated text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Side Actions */}
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">
          Settings
        </button>
        <button className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">
          Help
        </button>
      </div>
    </header>
  );
}
