import { create } from 'zustand';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Chart UI State Store
 * Manages chart UI state including zoom, pan, visibility settings
 */
interface ChartUIState {
  // Zoom and pan
  zoomLevel: number;
  panOffset: number;
  
  // Chart dimensions
  width: number;
  height: number;
  
  // Visibility
  showGrid: boolean;
  showCrosshair: boolean;
  showVolume: boolean;
  showPriceScale: boolean;
  showTimeScale: boolean;
  
  // Actions
  setZoomLevel: (level: number) => void;
  setPanOffset: (offset: number) => void;
  setDimensions: (width: number, height: number) => void;
  toggleGrid: () => void;
  toggleCrosshair: () => void;
  toggleVolume: () => void;
  togglePriceScale: () => void;
  toggleTimeScale: () => void;
  resetView: () => void;
}

export const useChartUIStore = create<ChartUIState>((set) => ({
  // Initial state
  zoomLevel: 1,
  panOffset: 0,
  width: 800,
  height: 600,
  showGrid: true,
  showCrosshair: true,
  showVolume: true,
  showPriceScale: true,
  showTimeScale: true,
  
  // Actions
  setZoomLevel: (level) => set({ zoomLevel: Math.max(0.1, Math.min(10, level)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),
  setDimensions: (width, height) => set({ width, height }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleCrosshair: () => set((state) => ({ showCrosshair: !state.showCrosshair })),
  toggleVolume: () => set((state) => ({ showVolume: !state.showVolume })),
  togglePriceScale: () => set((state) => ({ showPriceScale: !state.showPriceScale })),
  toggleTimeScale: () => set((state) => ({ showTimeScale: !state.showTimeScale })),
  resetView: () => set({ zoomLevel: 1, panOffset: 0 }),
}));

/**
 * Market Data State Store
 * Manages market data state including candles, trades, order book
 */
interface MarketDataState {
  // Current symbol and timeframe
  symbol: string;
  timeframe: Timeframe;
  
  // Candle data
  candles: Candle[];
  lastUpdate: number;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setCandles: (candles: Candle[]) => void;
  addCandle: (candle: Candle) => void;
  updateLastCandle: (candle: Candle) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMarketDataStore = create<MarketDataState>((set) => ({
  // Initial state
  symbol: 'BTCUSDT',
  timeframe: '1m',
  candles: [],
  lastUpdate: 0,
  isLoading: false,
  error: null,
  
  // Actions
  setSymbol: (symbol) => set({ symbol, candles: [], lastUpdate: 0 }),
  setTimeframe: (timeframe) => set({ timeframe, candles: [], lastUpdate: 0 }),
  setCandles: (candles) => set({ candles, lastUpdate: Date.now(), error: null }),
  addCandle: (candle) => set((state) => ({
    candles: [...state.candles, candle],
    lastUpdate: Date.now(),
  })),
  updateLastCandle: (candle) => set((state) => {
    const candles = [...state.candles];
    if (candles.length > 0) {
      candles[candles.length - 1] = candle;
    }
    return { candles, lastUpdate: Date.now() };
  }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));

/**
 * Chart Mode Store
 * Manages different chart modes (candlestick, line, area, etc.)
 * Placeholder for future modes like footprint, heatmap
 */
type ChartMode = 'candlestick' | 'line' | 'area' | 'baseline';

interface ChartModeState {
  mode: ChartMode;
  // Future mode configurations
  footprintConfig: FootprintConfig | null;
  heatmapConfig: HeatmapConfig | null;
  
  // Actions
  setMode: (mode: ChartMode) => void;
  // Future: setFootprintConfig, setHeatmapConfig
}

interface FootprintConfig {
  // Placeholder for footprint chart configuration
  aggregationType: 'delta' | 'volume' | 'trade_count';
  levels: number;
}

interface HeatmapConfig {
  // Placeholder for heatmap configuration
  metric: 'volume' | 'liquidity' | 'delta';
  levels: number;
}

export const useChartModeStore = create<ChartModeState>((set) => ({
  mode: 'candlestick',
  footprintConfig: null,
  heatmapConfig: null,
  
  setMode: (mode) => set({ mode }),
}));

/**
 * WebSocket Connection State Store
 */
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
  lastPing: number;
  reconnectAttempts: number;
  subscribedSymbols: string[];
  
  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setLastPing: (time: number) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  addSubscription: (symbol: string) => void;
  removeSubscription: (symbol: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  lastPing: 0,
  reconnectAttempts: 0,
  subscribedSymbols: [],
  
  setStatus: (status) => set({ status }),
  setLastPing: (lastPing) => set({ lastPing }),
  incrementReconnectAttempts: () => set((state) => ({
    reconnectAttempts: state.reconnectAttempts + 1,
  })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
  addSubscription: (symbol) => set((state) => ({
    subscribedSymbols: [...new Set([...state.subscribedSymbols, symbol])],
  })),
  removeSubscription: (symbol) => set((state) => ({
    subscribedSymbols: state.subscribedSymbols.filter((s) => s !== symbol),
  })),
}));
