/**
 * Chart Controller
 * 
 * Central controller for managing chart state, view transformations,
 * and coordinating the rendering pipeline.
 */

// Candle type (duplicated to avoid workspace dependency issues)
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartConfig {
  width: number;
  height: number;
  candleWidth: number;
  candleGap: number;
  volumeHeight: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface ViewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
  scaleX: number;
  scaleY: number;
}

export interface VisibleRange {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  priceMin: number;
  priceMax: number;
}

export class ChartController {
  private config: ChartConfig;
  private view: ViewState;
  private candles: Candle[] = [];
  
  // Calculated values
  private chartWidth: number = 0;
  private chartHeight: number = 0;
  private candleAreaWidth: number = 0;
  private maxVisibleCandles: number = 0;
  
  // Callbacks
  private onUpdateCallbacks: Array<() => void> = [];

  constructor(config?: Partial<ChartConfig>) {
    this.config = {
      width: 800,
      height: 600,
      candleWidth: 8,
      candleGap: 2,
      volumeHeight: 80,
      padding: {
        top: 20,
        right: 80,
        bottom: 30,
        left: 10,
      },
      ...config,
    };

    this.view = {
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      scaleX: 1,
      scaleY: 1,
    };

    this.recalculate();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ChartConfig>) {
    this.config = { ...this.config, ...config };
    this.recalculate();
    this.notifyUpdate();
  }

  /**
   * Set candles data
   */
  setCandles(candles: Candle[]) {
    this.candles = candles;
    this.ensureViewInBounds();
    this.notifyUpdate();
  }

  /**
   * Get candles data
   */
  getCandles(): Candle[] {
    return this.candles;
  }

  /**
   * Get current view state
   */
  getView(): ViewState {
    return { ...this.view };
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number) {
    this.view.zoom = Math.max(0.1, Math.min(10, zoom));
    this.view.scaleX = this.view.zoom;
    this.recalculate();
    this.ensureViewInBounds();
    this.notifyUpdate();
  }

  /**
   * Set pan offset
   */
  setOffset(x: number, y: number = 0) {
    this.view.offsetX = x;
    this.view.offsetY = y;
    this.ensureViewInBounds();
    this.notifyUpdate();
  }

  /**
   * Pan the chart by delta
   */
  pan(deltaX: number) {
    this.view.offsetX += deltaX;
    this.ensureViewInBounds();
    this.notifyUpdate();
  }

  /**
   * Zoom at a specific position
   */
  zoomAt(factor: number, mouseX: number) {
    const oldZoom = this.view.zoom;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom * factor));
    
    // Calculate the adjustment to zoom at mouse position
    const candlesPerPixel = this.maxVisibleCandles / this.chartWidth;
    const mouseCandle = mouseX * candlesPerPixel;
    
    this.view.zoom = newZoom;
    this.view.scaleX = newZoom;
    this.recalculate();
    
    // Adjust offset to keep the same candle under the mouse
    const newCandlesPerPixel = this.maxVisibleCandles / this.chartWidth;
    this.view.offsetX = (mouseCandle / newCandlesPerPixel) * (this.candleAreaWidth / this.chartWidth);
    
    this.ensureViewInBounds();
    this.notifyUpdate();
  }

  /**
   * Get the visible range of candles
   */
  getVisibleRange(): VisibleRange {
    const candlesPerPixel = this.maxVisibleCandles / this.chartWidth;
    const startCandle = Math.floor(-this.view.offsetX * candlesPerPixel);
    const endCandle = Math.ceil(startCandle + this.maxVisibleCandles);

    const startIndex = Math.max(0, startCandle);
    const endIndex = Math.min(this.candles.length, endCandle);

    const visibleCandles = this.candles.slice(startIndex, endIndex);
    
    let priceMin = Infinity;
    let priceMax = -Infinity;
    
    for (const candle of visibleCandles) {
      priceMin = Math.min(priceMin, candle.low);
      priceMax = Math.max(priceMax, candle.high);
    }

    // Add padding to price range
    const pricePadding = (priceMax - priceMin) * 0.05;
    priceMin -= pricePadding;
    priceMax += pricePadding;

    return {
      startIndex,
      endIndex,
      startTime: visibleCandles[0]?.time || 0,
      endTime: visibleCandles[visibleCandles.length - 1]?.time || 0,
      priceMin,
      priceMax,
    };
  }

  /**
   * Convert screen coordinates to data coordinates
   */
  screenToData(x: number, y: number): { index: number; time: number; price: number } {
    const candlesPerPixel = this.maxVisibleCandles / this.chartWidth;
    const index = Math.floor((x / this.chartWidth) * this.maxVisibleCandles - this.view.offsetX * candlesPerPixel);
    const candle = this.candles[index];
    
    const priceRange = this.getVisibleRange();
    const price = priceRange.priceMax - (y / this.chartHeight) * (priceRange.priceMax - priceRange.priceMin);

    return {
      index,
      time: candle?.time || 0,
      price,
    };
  }

  /**
   * Convert data coordinates to screen coordinates
   */
  dataToScreen(index: number, price: number): { x: number; y: number } {
    const candlesPerPixel = this.maxVisibleCandles / this.chartWidth;
    const x = ((index + this.view.offsetX) / candlesPerPixel + this.chartWidth * 0) * (1 / this.chartWidth) * this.chartWidth;
    
    const range = this.getVisibleRange();
    const y = this.chartHeight - ((price - range.priceMin) / (range.priceMax - range.priceMin)) * this.chartHeight;

    return { x, y };
  }

  /**
   * Get the effective candle width based on zoom
   */
  getEffectiveCandleWidth(): number {
    return (this.config.candleWidth + this.config.candleGap) * this.view.scaleX;
  }

  /**
   * Subscribe to update events
   */
  onUpdate(callback: () => void) {
    this.onUpdateCallbacks.push(callback);
    return () => {
      const index = this.onUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.onUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Reset view to default
   */
  resetView() {
    this.view = {
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      scaleX: 1,
      scaleY: 1,
    };
    this.recalculate();
    this.notifyUpdate();
  }

  /**
   * Fit all candles in view
   */
  fitAll() {
    if (this.candles.length === 0) return;
    
    const candleWidthWithGap = this.config.candleWidth + this.config.candleGap;
    const targetCandles = Math.floor(this.chartWidth / candleWidthWithGap);
    
    this.view.zoom = Math.min(1, targetCandles / this.candles.length);
    this.view.scaleX = this.view.zoom;
    this.view.offsetX = this.candles.length - targetCandles;
    
    this.recalculate();
    this.notifyUpdate();
  }

  /**
   * Recalculate internal values
   */
  private recalculate() {
    this.chartWidth = this.config.width - this.config.padding.left - this.config.padding.right;
    this.chartHeight = this.config.height - this.config.padding.top - this.config.padding.bottom - this.config.volumeHeight;
    this.candleAreaWidth = this.chartWidth;
    
    const candleWidthWithGap = (this.config.candleWidth + this.config.candleGap) * this.view.scaleX;
    this.maxVisibleCandles = Math.ceil(this.chartWidth / candleWidthWithGap);
  }

  /**
   * Ensure view is within bounds
   */
  private ensureViewInBounds() {
    const maxOffset = Math.max(0, this.candles.length - this.maxVisibleCandles);
    this.view.offsetX = Math.max(0, Math.min(maxOffset, this.view.offsetX));
  }

  /**
   * Notify all subscribers of an update
   */
  private notifyUpdate() {
    for (const callback of this.onUpdateCallbacks) {
      callback();
    }
  }
}
