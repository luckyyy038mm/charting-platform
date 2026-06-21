//! Market state management for the charting platform.
//! This module provides centralized state management for market data,
//! including symbol states, aggregates, and historical data caching.

use dashmap::DashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use chrono::{DateTime, Utc};

/// Timeframe enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Timeframe {
    M1,
    M5,
    M15,
    M1H,
    M4H,
    D1,
}

impl Timeframe {
    pub fn as_str(&self) -> &'static str {
        match self {
            Timeframe::M1 => "1m",
            Timeframe::M5 => "5m",
            Timeframe::M15 => "15m",
            Timeframe::M1H => "1h",
            Timeframe::M4H => "4h",
            Timeframe::D1 => "1d",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "1m" => Some(Timeframe::M1),
            "5m" => Some(Timeframe::M5),
            "15m" => Some(Timeframe::M15),
            "1h" => Some(Timeframe::M1H),
            "4h" => Some(Timeframe::M4H),
            "1d" => Some(Timeframe::D1),
            _ => None,
        }
    }
}

/// OHLCV candle data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub open_time: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub quote_volume: f64,
    pub trades_count: i64,
    pub close_time: i64,
    pub is_closed: bool,
}

impl Candle {
    pub fn new(open_time: i64, timeframe: &Timeframe) -> Self {
        let duration = timeframe.duration_ms();
        Self {
            open_time,
            open: 0.0,
            high: 0.0,
            low: 0.0,
            close: 0.0,
            volume: 0.0,
            quote_volume: 0.0,
            trades_count: 0,
            close_time: open_time + duration,
            is_closed: false,
        }
    }

    pub fn update(&mut self, price: f64, volume: f64, trades_count: i64) {
        if self.open == 0.0 {
            self.open = price;
        }
        self.high = self.high.max(price);
        self.low = if self.low == 0.0 { price } else { self.low.min(price) };
        self.close = price;
        self.volume += volume;
        self.trades_count += trades_count;
    }
}

impl Timeframe {
    pub fn duration_ms(&self) -> i64 {
        match self {
            Timeframe::M1 => 60_000,
            Timeframe::M5 => 300_000,
            Timeframe::M15 => 900_000,
            Timeframe::M1H => 3_600_000,
            Timeframe::M4H => 14_400_000,
            Timeframe::D1 => 86_400_000,
        }
    }
}

/// Symbol market state
pub struct SymbolState {
    pub symbol: String,
    pub last_price: RwLock<f64>,
    pub best_bid: RwLock<Option<(f64, f64)>>, // (price, quantity)
    pub best_ask: RwLock<Option<(f64, f64)>>,
    pub candles: RwLock<HashMap<Timeframe, Vec<Candle>>>,
    pub trades: RwLock<Vec<Trade>>,
    // Future placeholders
    pub footprint_cache: RwLock<Option<()>>,
    pub heatmap_cache: RwLock<Option<()>>,
}

impl SymbolState {
    pub fn new(symbol: String) -> Self {
        Self {
            symbol,
            last_price: RwLock::new(0.0),
            best_bid: RwLock::new(None),
            best_ask: RwLock::new(None),
            candles: RwLock::new(HashMap::new()),
            trades: RwLock::new(Vec::new()),
            footprint_cache: RwLock::new(None),
            heatmap_cache: RwLock::new(None),
        }
    }

    pub fn update_price(&self, price: f64) {
        *self.last_price.write() = price;
    }

    pub fn update_bid_ask(&self, bid: Option<(f64, f64)>, ask: Option<(f64, f64)>) {
        *self.best_bid.write() = bid;
        *self.best_ask.write() = ask;
    }

    pub fn add_candle(&self, timeframe: Timeframe, candle: Candle) {
        let mut candles = self.candles.write();
        candles.entry(timeframe).or_insert_with(Vec::new).push(candle);
    }

    pub fn get_candles(&self, timeframe: Timeframe, limit: usize) -> Vec<Candle> {
        let candles = self.candles.read();
        candles.get(&timeframe)
            .map(|c| c.iter().rev().take(limit).cloned().collect())
            .unwrap_or_default()
    }

    pub fn add_trade(&self, trade: Trade) {
        let mut trades = self.trades.write();
        trades.push(trade);
        if trades.len() > 1000 {
            trades.remove(0);
        }
    }
}

/// Trade data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub trade_id: String,
    pub price: f64,
    pub quantity: f64,
    pub quote_volume: f64,
    pub is_buyer_maker: bool,
    pub timestamp: i64,
}

/// Market state manager
pub struct MarketState {
    symbols: Arc<DashMap<String, Arc<SymbolState>>>,
}

impl MarketState {
    pub fn new() -> Self {
        Self {
            symbols: Arc::new(DashMap::new()),
        }
    }

    pub fn get_or_create(&self, symbol: &str) -> Arc<SymbolState> {
        self.symbols
            .entry(symbol.to_string())
            .or_insert_with(|| Arc::new(SymbolState::new(symbol.to_string())))
            .clone()
    }

    pub fn get(&self, symbol: &str) -> Option<Arc<SymbolState>> {
        self.symbols.get(symbol).map(|r| r.clone())
    }
}

impl Default for MarketState {
    fn default() -> Self {
        Self::new()
    }
}

/// Snapshot for a symbol's current state
#[derive(Debug, Serialize, Deserialize)]
pub struct SymbolSnapshot {
    pub symbol: String,
    pub last_price: f64,
    pub best_bid: Option<(f64, f64)>,
    pub best_ask: Option<(f64, f64)>,
    pub timestamp: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timeframe_from_str() {
        assert_eq!(Timeframe::from_str("1m"), Some(Timeframe::M1));
        assert_eq!(Timeframe::from_str("5m"), Some(Timeframe::M5));
        assert_eq!(Timeframe::from_str("1h"), Some(Timeframe::M1H));
        assert_eq!(Timeframe::from_str("invalid"), None);
    }

    #[test]
    fn test_candle_update() {
        let mut candle = Candle::new(0, &Timeframe::M1);
        candle.update(100.0, 10.0, 5);
        
        assert_eq!(candle.open, 100.0);
        assert_eq!(candle.high, 100.0);
        assert_eq!(candle.low, 100.0);
        assert_eq!(candle.close, 100.0);
        assert_eq!(candle.volume, 10.0);
        
        candle.update(105.0, 5.0, 3);
        assert_eq!(candle.high, 105.0);
        assert_eq!(candle.low, 100.0);
    }

    #[test]
    fn test_market_state() {
        let state = MarketState::new();
        let symbol_state = state.get_or_create("btcusdt");
        
        symbol_state.update_price(50000.0);
        assert_eq!(*symbol_state.last_price.read(), 50000.0);
    }
}
