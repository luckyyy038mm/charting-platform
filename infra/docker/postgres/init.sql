-- =============================================================================
-- Charting Platform Database Initialization
-- =============================================================================
-- This script is run on first startup to set up TimescaleDB extension
-- and initial schema for the charting platform.

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- =============================================================================
-- Platform Metadata Tables
-- =============================================================================

-- Symbols table for tracking tradable instruments
CREATE TABLE IF NOT EXISTS symbols (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    base_asset VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL,
    exchange VARCHAR(20) NOT NULL DEFAULT 'binance_futures',
    contract_type VARCHAR(20) NOT NULL DEFAULT 'perpetual',
    tick_size DECIMAL(20, 10) NOT NULL,
    lot_size DECIMAL(20, 10) NOT NULL,
    min_quantity DECIMAL(20, 10) NOT NULL,
    max_quantity DECIMAL(20, 10) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_symbols_symbol ON symbols(symbol);
CREATE INDEX idx_symbols_exchange ON symbols(exchange);
CREATE INDEX idx_symbols_active ON symbols(is_active);

-- Workspaces table for user workspace configurations
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    user_id UUID, -- NULL for default workspace
    layout JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspaces_user ON workspaces(user_id);

-- Charts table for storing chart configurations
CREATE TABLE IF NOT EXISTS charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    chart_type VARCHAR(20) NOT NULL DEFAULT 'candlestick',
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 800,
    height INTEGER NOT NULL DEFAULT 600,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_charts_workspace ON charts(workspace_id);
CREATE INDEX idx_charts_symbol ON charts(symbol);

-- =============================================================================
-- Market Data Tables (TimescaleDB Hypertables)
-- =============================================================================

-- Candlestick/OHLC data
CREATE TABLE IF NOT EXISTS candles (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    open DECIMAL(20, 10) NOT NULL,
    high DECIMAL(20, 10) NOT NULL,
    low DECIMAL(20, 10) NOT NULL,
    close DECIMAL(20, 10) NOT NULL,
    volume DECIMAL(24, 10) NOT NULL,
    quote_volume DECIMAL(24, 10), -- USDT volume for futures
    trades_count BIGINT,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (time, symbol, timeframe)
);

SELECT create_hypertable('candles', 'time', if_not_exists => TRUE);

CREATE INDEX idx_candles_symbol_tf ON candles(symbol, timeframe);
CREATE INDEX idx_candles_closed ON candles(is_closed) WHERE is_closed = true;

-- Trades table for individual trade data
CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    trade_id VARCHAR(50) NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 10) NOT NULL,
    quantity DECIMAL(20, 10) NOT NULL,
    quote_quantity DECIMAL(20, 10) NOT NULL,
    is_buyer_maker BOOLEAN NOT NULL,
    is_best_match BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);

CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_time ON trades(time DESC);

-- Order book snapshots (periodic)
CREATE TABLE IF NOT EXISTS orderbook_snapshots (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    bids JSONB NOT NULL, -- [{price, quantity}]
    asks JSONB NOT NULL,
    last_update_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (time, symbol)
);

SELECT create_hypertable('orderbook_snapshots', 'time', if_not_exists => TRUE);

CREATE INDEX idx_orderbook_symbol ON orderbook_snapshots(symbol);

-- =============================================================================
-- Chunks Retention Policy (Development)
-- =============================================================================

-- For development, keep 7 days of data
-- Production would have much longer retention for historical analysis
SELECT add_retention_policy('candles', INTERVAL '7 days');
SELECT add_retention_policy('trades', INTERVAL '7 days');
SELECT add_retention_policy('orderbook_snapshots', INTERVAL '1 days');

-- =============================================================================
-- Compression Policy for Historical Data
-- =============================================================================

-- Enable compression for old chunks to save space
ALTER TABLE candles SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol,timeframe'
);

SELECT add_compression_policy('candles', INTERVAL '1 day');

-- =============================================================================
-- Function: Update timestamp trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_symbols_updated_at
    BEFORE UPDATE ON symbols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_charts_updated_at
    BEFORE UPDATE ON charts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Initial Data: Sample Binance Futures Symbols
-- =============================================================================

INSERT INTO symbols (symbol, base_asset, quote_asset, exchange, tick_size, lot_size, min_quantity, max_quantity)
VALUES
    ('BTCUSDT', 'BTC', 'USDT', 'binance_futures', 0.01, 0.001, 0.001, 100),
    ('ETHUSDT', 'ETH', 'USDT', 'binance_futures', 0.01, 0.01, 0.01, 1000),
    ('BNBUSDT', 'BNB', 'USDT', 'binance_futures', 0.01, 0.01, 0.1, 10000),
    ('SOLUSDT', 'SOL', 'USDT', 'binance_futures', 0.01, 0.1, 0.1, 10000),
    ('XRPUSDT', 'XRP', 'USDT', 'binance_futures', 0.0001, 1.0, 1.0, 1000000)
ON CONFLICT (symbol) DO NOTHING;
