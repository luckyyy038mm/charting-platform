'use client';

import { useRef, useEffect, useCallback } from 'react';
import { ChartController, ChartRenderer } from '@charting-platform/chart-engine';

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
  mode?: 'candlestick' | 'line' | 'area' | 'baseline';
  showVolume?: boolean;
  showPriceScale?: boolean;
  showTimeScale?: boolean;
}

export function ChartCanvas({
  candles,
  mode = 'candlestick',
  showVolume = true,
  showPriceScale = true,
  showTimeScale = true,
}: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<ChartController | null>(null);
  const rendererRef = useRef<ChartRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize controller and renderer
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // Get container dimensions
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Initialize controller
    const controller = new ChartController({
      width: canvas.width,
      height: canvas.height,
    });
    controllerRef.current = controller;

    // Initialize renderer
    const renderer = new ChartRenderer(canvas);
    rendererRef.current = renderer;
    renderer.resize(canvas.width, canvas.height);

    // Handle resize
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

    // Handle wheel for zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      controller.zoomAt(factor, e.offsetX);
    };

    // Handle mouse down for pan
    let isDragging = false;
    let lastX = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = (e.clientX - lastX) / window.devicePixelRatio;
      controller.pan(deltaX);
      lastX = e.clientX;
    };

    const handleMouseUp = () => {
      isDragging = false;
      canvas.style.cursor = 'crosshair';
    };

    // Subscribe to controller updates
    const unsubscribe = controller.onUpdate(() => {
      render();
    });

    // Add event listeners
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Initial render
    controller.setCandles(candles);
    render();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      unsubscribe();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update candles when they change
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setCandles(candles);
      render();
    }
  }, [candles]);

  // Render function
  const render = useCallback(() => {
    if (!controllerRef.current || !rendererRef.current) return;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const controller = controllerRef.current!;
      const renderer = rendererRef.current!;
      
      renderer.render(
        controller.getCandles(),
        controller.getVisibleRange(),
        controller
      );
    });
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: 'crosshair' }}
      />
      {showPriceScale && <PriceScale candles={candles} />}
      {showTimeScale && <TimeScale candles={candles} />}
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
  
  // Show last N candles time labels
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
