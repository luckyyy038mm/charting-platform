'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useChartUIStore } from '@/stores/chartStore';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartCanvasProps {
  candles: Candle[];
}

export function ChartCanvas({ candles }: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { showPriceScale, showTimeScale } = useChartUIStore();
  const [webglSupported, setWebglSupported] = useState(true);

  // Check WebGL support
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    setWebglSupported(!!gl);
  }, []);

  // Canvas rendering (fallback when WebGL is not available)
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    if (webglSupported) return; // Let WebGL handle it if available

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Clear
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (candles.length === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Loading chart...', canvas.width / 2, canvas.height / 2);
        return;
      }

      // Calculate visible candles
      const padding = { top: 20, right: 80, bottom: 30, left: 10 };
      const volumeHeight = 80;
      const chartWidth = canvas.width - padding.left - padding.right;
      const chartHeight = canvas.height - padding.top - padding.bottom - volumeHeight;

      const visibleCount = Math.min(candles.length, Math.floor(chartWidth / 12));
      const startIndex = Math.max(0, candles.length - visibleCount);
      const visibleCandles = candles.slice(startIndex);

      // Calculate price range
      let minPrice = Infinity, maxPrice = -Infinity;
      let maxVolume = 0;
      for (const c of visibleCandles) {
        minPrice = Math.min(minPrice, c.low);
        maxPrice = Math.max(maxPrice, c.high);
        maxVolume = Math.max(maxVolume, c.volume);
      }
      const priceRange = maxPrice - minPrice || 1;

      // Draw grid
      ctx.strokeStyle = 'rgba(42, 42, 58, 0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (i / 5) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }

      // Draw candles
      const candleWidth = chartWidth / visibleCandles.length;
      for (let i = 0; i < visibleCandles.length; i++) {
        const c = visibleCandles[i];
        const x = padding.left + (i + 0.5) * candleWidth;
        
        const yHigh = padding.top + chartHeight - ((c.high - minPrice) / priceRange) * chartHeight;
        const yLow = padding.top + chartHeight - ((c.low - minPrice) / priceRange) * chartHeight;
        const yOpen = padding.top + chartHeight - ((c.open - minPrice) / priceRange) * chartHeight;
        const yClose = padding.top + chartHeight - ((c.close - minPrice) / priceRange) * chartHeight;
        
        const isBullish = c.close >= c.open;
        ctx.strokeStyle = isBullish ? '#22c55e' : '#ef4444';
        ctx.fillStyle = isBullish ? '#16a34a' : '#dc2626';
        
        // Wick
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();
        
        // Body
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
        ctx.fillRect(x - candleWidth * 0.4, bodyTop, candleWidth * 0.8, bodyHeight);
        
        // Volume
        const barHeight = maxVolume > 0 ? (c.volume / maxVolume) * (volumeHeight - 10) : 0;
        const yVol = canvas.height - padding.bottom - barHeight;
        ctx.fillStyle = isBullish ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        ctx.fillRect(x - candleWidth * 0.4, yVol, candleWidth * 0.8, barHeight);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [candles, webglSupported]);

  // WebGL rendering (when supported)
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    if (!webglSupported) return;

    // Dynamic import for WebGL chart engine
    import('@charting-platform/chart-engine').then(({ ChartController, ChartRenderer }) => {
      const canvas = canvasRef.current!;
      const container = containerRef.current!;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const controller = new ChartController({
        width: canvas.width,
        height: canvas.height,
      });

      const renderer = new ChartRenderer(canvas);
      renderer.resize(canvas.width, canvas.height);

      const handleResize = () => {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        controller.setConfig({ width: canvas.width, height: canvas.height });
        renderer.resize(canvas.width, canvas.height);
        render();
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        controller.zoomAt(factor, e.offsetX);
      };

      let isDragging = false;
      let lastX = 0;

      const handleMouseDown = (e: MouseEvent) => {
        isDragging = true;
        lastX = e.clientX;
        canvas.style.cursor = 'grabbing';
      };

      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * window.devicePixelRatio;
        const y = (e.clientY - rect.top) * window.devicePixelRatio;
        
        renderer.setCrosshair(x, y, true);
        render();
        
        if (isDragging) {
          const deltaX = (e.clientX - lastX) / window.devicePixelRatio;
          controller.pan(deltaX);
          lastX = e.clientX;
        }
      };

      const handleMouseLeave = () => {
        renderer.setCrosshair(0, 0, false);
        render();
      };

      const handleMouseUp = () => {
        isDragging = false;
        canvas.style.cursor = 'crosshair';
      };

      const unsubscribe = controller.onUpdate(render);

      window.addEventListener('resize', handleResize);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('mouseup', handleMouseUp);

      controller.setCandles(candles);
      render();

      return () => {
        window.removeEventListener('resize', handleResize);
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('mouseup', handleMouseUp);
        unsubscribe();
      };
    }).catch(err => {
      console.error('Failed to load chart engine:', err);
      setWebglSupported(false);
    });
  }, [webglSupported]);

  // Update candles
  useEffect(() => {
    if (webglSupported) {
      // Handled in WebGL effect
    }
  }, [candles, webglSupported]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: 'crosshair' }}
      />
      {showPriceScale && webglSupported && <PriceScale candles={candles} />}
      {showTimeScale && webglSupported && <TimeScale candles={candles} />}
    </div>
  );
}

function PriceScale({ candles }: { candles: Candle[] }) {
  if (candles.length === 0) return null;

  const prices: number[] = [];
  for (const c of candles) {
    prices.push(c.high, c.low);
  }
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const range = max - min;
  const step = range / 5;

  return (
    <div className="absolute right-0 top-0 h-full w-20 bg-background-secondary/50 pointer-events-none flex flex-col justify-between py-4 text-2xs font-mono text-text-muted">
      {Array.from({ length: 6 }).map((_, i) => {
        const price = max - i * step;
        return (
          <span key={i} className="text-right pr-2">
            {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      })}
    </div>
  );
}

function TimeScale({ candles }: { candles: Candle[] }) {
  if (candles.length === 0) return null;
  
  const visibleCount = Math.min(6, candles.length);
  const startIndex = candles.length - visibleCount;
  
  return (
    <div className="absolute bottom-0 left-0 right-20 h-6 bg-background-secondary/50 pointer-events-none flex items-center text-2xs font-mono text-text-muted">
      {candles.slice(startIndex).map((candle, i) => {
        const date = new Date(candle.time);
        const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <span
            key={i}
            className="absolute"
            style={{ left: `${(i / visibleCount) * 100}%` }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
