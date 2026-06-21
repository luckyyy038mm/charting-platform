/**
 * Chart Renderer
 * 
 * WebGL-based renderer for efficient chart drawing.
 * Uses a layered approach for different chart components.
 */

import type { ChartController, VisibleRange } from './ChartController';

// Candle type definition (duplicated here to avoid workspace dependency issues)
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Vertex shader for candlesticks
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  
  uniform vec2 u_resolution;
  
  varying vec4 v_color;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_color = a_color;
  }
`;

// Fragment shader for candlesticks
const FRAGMENT_SHADER = `
  precision mediump float;
  
  varying vec4 v_color;
  
  void main() {
    gl_FragColor = v_color;
  }
`;

// Colors
const COLORS = {
  bull: [0.133, 0.773, 0.369, 1.0],
  bullBody: [0.086, 0.639, 0.290, 1.0],
  bear: [0.937, 0.267, 0.267, 1.0],
  bearBody: [0.863, 0.149, 0.149, 1.0],
  wick: [0.627, 0.627, 0.690, 1.0],
  grid: [0.165, 0.165, 0.227, 0.3],
  crosshair: [0.392, 0.392, 0.502, 0.8],
  volumeBull: [0.133, 0.773, 0.369, 0.4],
  volumeBear: [0.937, 0.267, 0.267, 0.4],
};

export class ChartRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private colorBuffer: WebGLBuffer;
  private width: number = 0;
  private height: number = 0;
  
  // Rendering buffers
  private vertices: number[] = [];
  private colors: number[] = [];
  
  // Configuration
  private candleWidth: number = 8;
  private candleGap: number = 2;
  private volumeHeight: number = 80;
  private padding = { top: 20, right: 80, bottom: 30, left: 10 };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl;
    
    // Create shader program
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    
    // Create buffers
    this.positionBuffer = gl.createBuffer()!;
    this.colorBuffer = gl.createBuffer()!;
    
    // Setup GL state
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /**
   * Create and compile a shader
   */
  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error('Shader compilation error: ' + info);
    }
    
    return shader;
  }

  /**
   * Create shader program
   */
  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      throw new Error('Program linking error: ' + info);
    }
    
    return program;
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.gl.clearColor(0.039, 0.039, 0.059, 1.0); // #0a0a0f
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * Render the chart
   */
  render(
    candles: Candle[],
    visibleRange: VisibleRange,
    controller: ChartController
  ) {
    this.clear();
    
    this.gl.useProgram(this.program);
    
    // Clear buffers
    this.vertices = [];
    this.colors = [];
    
    // Render grid
    this.renderGrid(visibleRange);
    
    // Render candles
    this.renderCandles(candles, visibleRange);
    
    // Render volume
    this.renderVolume(candles, visibleRange);
    
    // Flush to GPU
    this.flush();
  }

  /**
   * Render grid lines
   */
  private renderGrid(visibleRange: VisibleRange) {
    const chartHeight = this.height - this.padding.top - this.padding.bottom - this.volumeHeight;
    const chartWidth = this.width - this.padding.left - this.padding.right;
    
    // Horizontal price grid lines
    const priceSteps = 5;
    const priceRange = visibleRange.priceMax - visibleRange.priceMin;
    const priceStep = priceRange / priceSteps;
    
    for (let i = 0; i <= priceSteps; i++) {
      const price = visibleRange.priceMin + i * priceStep;
      const y = this.padding.top + chartHeight - ((price - visibleRange.priceMin) / priceRange) * chartHeight;
      
      this.addLine(
        this.padding.left,
        y,
        this.padding.left + chartWidth,
        y,
        COLORS.grid
      );
    }
    
    // Vertical time grid lines
    const timeSteps = 6;
    const visibleCount = visibleRange.endIndex - visibleRange.startIndex;
    const timeStep = Math.ceil(visibleCount / timeSteps);
    
    for (let i = 0; i <= timeSteps; i++) {
      const index = visibleRange.startIndex + i * timeStep;
      const x = this.padding.left + ((index - visibleRange.startIndex) / visibleCount) * chartWidth;
      
      this.addLine(
        x,
        this.padding.top,
        x,
        this.padding.top + chartHeight
      , COLORS.grid);
    }
  }

  /**
   * Render candlesticks
   */
  private renderCandles(candles: Candle[], visibleRange: VisibleRange) {
    const chartHeight = this.height - this.padding.top - this.padding.bottom - this.volumeHeight;
    const chartWidth = this.width - this.padding.left - this.padding.right;
    const candleStep = chartWidth / Math.max(1, visibleRange.endIndex - visibleRange.startIndex);
    const priceRange = visibleRange.priceMax - visibleRange.priceMin;

    for (let i = visibleRange.startIndex; i < visibleRange.endIndex; i++) {
      const candle = candles[i];
      if (!candle) continue;

      const x = this.padding.left + ((i - visibleRange.startIndex) + 0.5) * candleStep;
      const halfWidth = (this.candleWidth / 2) * 0.8;

      // Calculate Y positions
      const yHigh = this.padding.top + chartHeight - ((candle.high - visibleRange.priceMin) / priceRange) * chartHeight;
      const yLow = this.padding.top + chartHeight - ((candle.low - visibleRange.priceMin) / priceRange) * chartHeight;
      const yOpen = this.padding.top + chartHeight - ((candle.open - visibleRange.priceMin) / priceRange) * chartHeight;
      const yClose = this.padding.top + chartHeight - ((candle.close - visibleRange.priceMin) / priceRange) * chartHeight;

      const isBullish = candle.close >= candle.open;
      const wickColor = COLORS.wick;
      const bodyColor = isBullish ? COLORS.bullBody : COLORS.bearBody;

      // Draw wick (high to low line)
      this.addLine(x, yHigh, x, yLow, wickColor);

      // Draw body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyBottom = Math.max(yOpen, yClose);
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);
      
      this.addRect(x - halfWidth, bodyTop, halfWidth * 2, bodyHeight, bodyColor);
    }
  }

  /**
   * Render volume bars
   */
  private renderVolume(candles: Candle[], visibleRange: VisibleRange) {
    const chartWidth = this.width - this.padding.left - this.padding.right;
    const volumeTop = this.height - this.padding.bottom - this.volumeHeight;
    const candleStep = chartWidth / Math.max(1, visibleRange.endIndex - visibleRange.startIndex);

    let maxVolume = 0;
    for (let i = visibleRange.startIndex; i < visibleRange.endIndex; i++) {
      const candle = candles[i];
      if (candle && candle.volume > maxVolume) {
        maxVolume = candle.volume;
      }
    }

    for (let i = visibleRange.startIndex; i < visibleRange.endIndex; i++) {
      const candle = candles[i];
      if (!candle) continue;

      const x = this.padding.left + ((i - visibleRange.startIndex) + 0.5) * candleStep;
      const halfWidth = (this.candleWidth / 2) * 0.8;
      const barHeight = (candle.volume / maxVolume) * (this.volumeHeight - 10);
      const y = this.height - this.padding.bottom - barHeight;

      const isBullish = candle.close >= candle.open;
      const color = isBullish ? COLORS.volumeBull : COLORS.volumeBear;

      this.addRect(x - halfWidth, y, halfWidth * 2, barHeight, color);
    }
  }

  /**
   * Add a line to the render buffer
   */
  private addLine(x1: number, y1: number, x2: number, y2: number, color: number[]) {
    // Convert to clip space (-1 to 1)
    const px1 = (x1 / this.width) * 2 - 1;
    const py1 = (y1 / this.height) * 2 - 1;
    const px2 = (x2 / this.width) * 2 - 1;
    const py2 = (y2 / this.height) * 2 - 1;

    this.vertices.push(px1, py1, px2, py2);
    this.colors.push(...color, ...color);
  }

  /**
   * Add a rectangle to the render buffer
   */
  private addRect(x: number, y: number, width: number, height: number, color: number[]) {
    // Convert to clip space (-1 to 1)
    const x1 = (x / this.width) * 2 - 1;
    const y1 = (y / this.height) * 2 - 1;
    const x2 = ((x + width) / this.width) * 2 - 1;
    const y2 = ((y + height) / this.height) * 2 - 1;

    // Two triangles for the rectangle
    // Triangle 1
    this.vertices.push(x1, y1, x2, y1, x1, y2);
    // Triangle 2
    this.vertices.push(x2, y1, x2, y2, x1, y2);

    // Add colors for 6 vertices
    for (let i = 0; i < 6; i++) {
      this.colors.push(...color);
    }
  }

  /**
   * Flush the render buffers to GPU
   */
  private flush() {
    if (this.vertices.length === 0) return;

    const gl = this.gl;
    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    const colorLocation = gl.getAttribLocation(this.program, 'a_color');

    // Upload position data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Upload color data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, this.vertices.length / 2);
  }
}
