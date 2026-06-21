# Charting Platform Architecture Overview

## Introduction

The Charting Platform is a professional-grade browser-based charting application for crypto markets, starting with Binance Futures. It is designed from the ground up for high-performance real-time data visualization, including order flow, footprint charts, DOM/ladder views, and liquidity heatmaps.

## System Layers

The platform is built in distinct layers, each with clear responsibilities:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend / Web UI                         │
│   Next.js + React + WebGL Chart Engine + Zustand + TanStack │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                 Go Platform API + WebSocket Gateway          │
│   HTTP REST API | WebSocket Fan-out | Valkey Pub/Sub Client │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│              Market Data Processing Layer (Rust)             │
│   Binance Connector | Event Normalization | Market Core     │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    Market Data Sources                       │
│              Binance Futures WebSocket / REST                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Valkey                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pub/Sub   │  │  Hot Data   │  │  Service Heartbeat │  │
│  │   Channel   │  │   Cache     │  │      Store         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL / TimescaleDB                    │
│  ┌─────────────────┐  ┌────────────────────────────────────┐ │
│  │ Platform Data   │  │     Historical Market Data         │ │
│  │ (workspaces,    │  │     (candles, trades,             │ │
│  │  charts, users) │  │      orderbook snapshots)         │ │
│  └─────────────────┘  └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Frontend (`/apps/web`)

- **Next.js Application**: Server-side rendering, routing, API routes
- **React Components**: UI components, chart workspace, toolbar, panels
- **WebGL Chart Engine** (`/packages/chart-engine`): High-performance chart rendering
- **Zustand Stores**: Client-side state management for chart UI, market data, connection state
- **TanStack Query**: Data fetching, caching, synchronization
- **WebSocket Client**: Real-time market data connection to Go gateway

### Platform API (`/apps/platform-api`)

- **HTTP REST API**: System health, symbol metadata, workspace APIs
- **WebSocket Gateway**: Fan-out market data to connected browsers
- **Valkey Client**: Subscribe to market event channels, cache management
- **Market Service**: Internal service for routing market events

### Market Services (`/services`)

#### Connector-Binance (`/services/connector-binance`)
- Connects to Binance Futures WebSocket streams
- Normalizes raw exchange data into platform event format
- Publishes events to Valkey pub/sub channels
- Maintains symbol state (current kline, recent trades, depth)
- Handles reconnection logic

#### Market-Core (`/services/market-core`)
- Processes and aggregates market events
- Maintains centralized market state
- Future: Advanced analytics, pattern detection

## Data Flow

### Live Market Data Flow

```
Binance Futures WebSocket
        │
        ▼
┌───────────────────┐
│  Rust Connector   │
│  - Parse messages │
│  - Normalize data │
│  - Publish events │
└───────────────────┘
        │
        ▼ (Valkey Pub/Sub)
┌───────────────────┐
│      Valkey       │
│  market:{symbol}   │
│  channel          │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│    Go Gateway     │
│  - Subscribe      │
│  - Fan-out WS     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   Browser Client  │
│  - Update state  │
│  - Render chart   │
└───────────────────┘
```

### Historical Data Flow (Future)

```
Browser Request
       │
       ▼
┌───────────────────┐
│   Go Platform API │
│  /api/candles     │
└───────────────────┘
       │
       ▼
┌───────────────────┐
│  PostgreSQL/      │
│  TimescaleDB       │
│  (Hypertable)     │
└───────────────────┘
       │
       ▼
   Historical
    Candles
```

## WebSocket Protocol

### Client → Server Messages

```typescript
// Subscribe to symbol
{ type: "subscribe", channel: "market", symbol: "btcusdt" }

// Unsubscribe from symbol
{ type: "unsubscribe", channel: "market", symbol: "btcusdt" }

// Ping
{ type: "ping" }
```

### Server → Client Messages

```typescript
// Connected acknowledgment
{ type: "connected", channel: "control", data: { client_id: "...", message: "..." } }

// Kline update
{ type: "kline", channel: "market", symbol: "btcusdt", data: { ... } }

// Trade update
{ type: "trade", channel: "market", symbol: "btcusdt", data: { ... } }

// Pong
{ type: "pong", channel: "control" }
```

## Market Event Schema

All market events use a normalized format defined in `/packages/shared-schema`:

- `TradeEvent`: Individual trade executions
- `KlineEvent`: Candlestick/OHLC updates
- `DepthEvent`: Order book depth updates
- `TickerEvent`: 24hr statistics
- `MarketStatusEvent`: Service/status events

## Chart Engine Architecture

The chart engine is a dedicated WebGL subsystem, separate from React rendering:

```
┌─────────────────────────────────────────┐
│         ChartController                 │
│  - View state (zoom, pan, offset)       │
│  - Visible range calculation            │
│  - Coordinate transformations           │
│  - Event subscription                  │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│          ChartRenderer (WebGL)           │
│  - Grid layer                           │
│  - Candlestick layer                    │
│  - Volume layer                         │
│  - Crosshair layer                     │
│  - Drawing layer (future)               │
└─────────────────────────────────────────┘
```

## Security Considerations

- Valkey authentication via password (configured via environment)
- PostgreSQL authentication for application access
- CORS configuration for API endpoints
- WebSocket connections authenticated via tokens (future)

## Performance Targets

- 60 FPS chart rendering
- < 100ms latency from exchange to chart
- Support for 1000+ simultaneous WebSocket connections
- Efficient memory usage with streaming data

## Future Extensions

### Phase 2
- Order book visualization
- Time & Sales / Tape
- Historical data API
- Replay mode foundation

### Phase 3
- Footprint charts
- Liquidity heatmap
- Advanced order book aggregation

### Phase 4
- Paper trading
- Signal generation
- Custom indicators
