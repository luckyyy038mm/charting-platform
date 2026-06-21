/**
 * Chart Engine Package
 * 
 * A custom WebGL-based chart rendering engine for professional trading charts.
 * Supports candlestick, line, area charts with zoom, pan, and crosshair interactions.
 */

export { ChartController } from './core/ChartController';
export type { ChartConfig, ViewState, VisibleRange } from './core/ChartController';

export { ChartRenderer } from './core/ChartRenderer';
export type { CrosshairState, Candle } from './core/ChartRenderer';
