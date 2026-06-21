# Charting Platform

A professional-grade browser-based charting platform for crypto markets, starting with Binance Futures.

## Overview

This platform is being built from scratch as a serious market terminal, inspired by TradingView, DeepCharts, ATAS, Exocharts, Quantower, and Bookmap.

### Core Features

- Professional chart workspace layout
- Real-time Binance Futures data sync
- Custom WebGL chart rendering engine
- Future: Order flow & footprint charts
- Future: DOM / Ladder view
- Future: Time & Sales / Tape
- Future: Liquidity heatmap
- Future: Replay mode
- Future: Paper trading & signals

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind, Zustand, TanStack Query |
| Chart Engine | Custom WebGL rendering |
| API Gateway | Go (Fiber) |
| Market Services | Rust |
| Cache & Pub/Sub | Valkey |
| Time Series DB | PostgreSQL / TimescaleDB |

## Project Structure

```
charting-platform/
├── apps/
│   ├── web/                    # Next.js frontend application
│   └── platform-api/           # Go API + WebSocket gateway
├── services/
│   ├── connector-binance/       # Rust Binance Futures connector
│   └── market-core/            # Rust market processing core
├── packages/
│   ├── shared-schema/          # Shared market event schemas
│   ├── market-types/           # TypeScript market types
│   ├── chart-engine/           # WebGL chart rendering engine
│   ├── chart-ui/               # Chart UI components
│   └── design-system/          # Design system primitives
├── infra/
│   └── docker/                  # Docker configurations
│       ├── valkey/             # Valkey configuration
│       └── postgres/           # PostgreSQL/TimescaleDB config
└── docs/
    ├── architecture/           # Architecture documentation
    └── phases/                # Phase planning documents
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- pnpm 8+
- Rust toolchain (for market services)

### Quick Start

1. **Clone and install dependencies**

```bash
git clone <repository-url>
cd charting-platform
pnpm install
```

2. **Start infrastructure services**

```bash
make infra-up
```

3. **Start the Go Platform API** (terminal 1)

```bash
cd apps/platform-api
go run cmd/server/main.go
```

4. **Start the Rust Binance Connector** (terminal 2)

```bash
cd services/connector-binance
cargo run
```

5. **Start the Web Frontend** (terminal 3)

```bash
cd apps/web
pnpm dev
```

6. **Open the application**

Navigate to [http://localhost:3000](http://localhost:3000)

### Using Docker Compose

You can also run all services via Docker Compose:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_URL` | PostgreSQL connection string | `postgresql://...` |
| `VALKEY_URL` | Valkey connection string | `redis://localhost:6379` |
| `API_PORT` | Go API port | `8080` |
| `BINANCE_FUTURES_WS_URL` | Binance WebSocket URL | `wss://stream.binance.com:9443/ws` |

## Available Scripts

```bash
# Install all dependencies
make install

# Start infrastructure only
make infra-up

# Start all services in development mode
make dev

# Start only the web frontend
make dev-web

# Start only the Go API
make dev-api

# Build all packages
make build

# Run linters
make lint

# Run tests
make test

# Format code
make format

# Clean build artifacts
make clean
```

## Architecture

The platform is built in layers:

```
┌────────────────────────────────────────┐
│          Frontend (Next.js)            │
│   React + WebGL Chart + Zustand        │
└────────────────────────────────────────┘
                  ↕
┌────────────────────────────────────────┐
│        Go Platform API                 │
│   HTTP REST + WebSocket Gateway         │
└────────────────────────────────────────┘
                  ↕
┌────────────────────────────────────────┐
│      Rust Market Services               │
│   Binance Connector + Market Core       │
└────────────────────────────────────────┘
                  ↕
┌────────────────────────────────────────┐
│    Data Layer (Valkey + PostgreSQL)     │
└────────────────────────────────────────┘
```

See [docs/architecture/overview.md](docs/architecture/overview.md) for detailed architecture documentation.

## Live Data Flow

```
Binance Futures
      ↓
Rust Connector (normalizes events)
      ↓
Valkey Pub/Sub
      ↓
Go Gateway (forwards to WebSocket)
      ↓
Browser (renders chart)
```

## Development

### Frontend Development

```bash
cd apps/web
pnpm dev
```

### API Development

```bash
cd apps/platform-api
go run cmd/server/main.go
```

### Rust Services Development

```bash
cd services/connector-binance
cargo run

# Or for market-core
cd services/market-core
cargo run
```

### Running Tests

```bash
# Frontend tests
pnpm --filter @charting-platform/web test

# API tests
cd apps/platform-api && go test ./...

# Rust tests
cd services/connector-binance && cargo test
cd services/market-core && cargo test
```

## Documentation

- [Architecture Overview](docs/architecture/overview.md)
- [Phase 1 Status](docs/phases/phase-1.md)

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Foundation, infrastructure, basic data flow |
| Phase 2 | ✅ Complete | Live candles, historical data, trades, order book |
| Phase 3 | 📋 Planned | Footprint charts, heatmap |
| Phase 4 | 📋 Planned | Replay mode, paper trading |

## Contributing

This is a private project under development.

## License

Private - All rights reserved
