use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Market event types that flow through the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MarketEventType {
    Trade,
    Kline,
    DepthSnapshot,
    DepthUpdate,
    Ticker,
    MarketStatus,
}

/// Trade event - individual trade execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TradeEvent {
    pub trade_id: String,
    pub symbol: String,
    pub price: f64,
    pub quantity: f64,
    pub quote_volume: f64,
    pub is_buyer_maker: bool,
    pub timestamp: i64,
    pub exchange: String,
}

impl TradeEvent {
    pub fn new(
        trade_id: String,
        symbol: String,
        price: f64,
        quantity: f64,
        is_buyer_maker: bool,
        timestamp: i64,
    ) -> Self {
        let quote_volume = price * quantity;
        Self {
            trade_id,
            symbol,
            price,
            quantity,
            quote_volume,
            is_buyer_maker,
            timestamp,
            exchange: "binance_futures".to_string(),
        }
    }
}

/// Kline/Candlestick event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KlineEvent {
    pub symbol: String,
    pub timeframe: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub quote_volume: f64,
    pub trades_count: i64,
    pub open_time: i64,
    pub close_time: i64,
    pub is_closed: bool,
    pub timestamp: i64,
    pub exchange: String,
}

impl KlineEvent {
    pub fn new(
        symbol: String,
        timeframe: String,
        open: f64,
        high: f64,
        low: f64,
        close: f64,
        volume: f64,
        open_time: i64,
        close_time: i64,
        is_closed: bool,
    ) -> Self {
        Self {
            symbol,
            timeframe,
            open,
            high,
            low,
            close,
            volume,
            quote_volume: 0.0, // Will be populated if available
            trades_count: 0,
            open_time,
            close_time,
            is_closed,
            timestamp: Utc::now().timestamp_millis(),
            exchange: "binance_futures".to_string(),
        }
    }
}

/// Order book depth update event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepthEvent {
    pub symbol: String,
    pub bids: Vec<(f64, f64)>, // (price, quantity)
    pub asks: Vec<(f64, f64)>,
    pub last_update_id: i64,
    pub timestamp: i64,
    pub exchange: String,
}

/// Ticker/24hr statistics event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickerEvent {
    pub symbol: String,
    pub price_change: f64,
    pub price_change_percent: f64,
    pub last_price: f64,
    pub high_price: f64,
    pub low_price: f64,
    pub volume: f64,
    pub quote_volume: f64,
    pub timestamp: i64,
    pub exchange: String,
}

/// Market status/heartbeat event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketStatusEvent {
    pub symbol: Option<String>,
    pub status: String,
    pub message: String,
    pub timestamp: i64,
    pub exchange: String,
}

impl MarketStatusEvent {
    pub fn new(status: &str, message: &str, symbol: Option<String>) -> Self {
        Self {
            symbol,
            status: status.to_string(),
            message: message.to_string(),
            timestamp: Utc::now().timestamp_millis(),
            exchange: "binance_futures".to_string(),
        }
    }
}

/// Wrapper for all market events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MarketEvent {
    Trade(TradeEvent),
    Kline(KlineEvent),
    Depth(DepthEvent),
    Ticker(TickerEvent),
    MarketStatus(MarketStatusEvent),
}

impl MarketEvent {
    pub fn symbol(&self) -> &str {
        match self {
            MarketEvent::Trade(e) => &e.symbol,
            MarketEvent::Kline(e) => &e.symbol,
            MarketEvent::Depth(e) => &e.symbol,
            MarketEvent::Ticker(e) => &e.symbol,
            MarketEvent::MarketStatus(e) => e.symbol.as_deref().unwrap_or("*"),
        }
    }

    pub fn timestamp(&self) -> i64 {
        match self {
            MarketEvent::Trade(e) => e.timestamp,
            MarketEvent::Kline(e) => e.timestamp,
            MarketEvent::Depth(e) => e.timestamp,
            MarketEvent::Ticker(e) => e.timestamp,
            MarketEvent::MarketStatus(e) => e.timestamp,
        }
    }
}

/// Internal message for the event bus
#[derive(Debug, Clone)]
pub struct MarketMessage {
    pub event_type: MarketEventType,
    pub symbol: String,
    pub data: Vec<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trade_event_new() {
        let trade = TradeEvent::new(
            "123".to_string(),
            "btcusdt".to_string(),
            50000.0,
            1.5,
            true,
            1234567890,
        );
        
        assert_eq!(trade.quote_volume, 75000.0);
        assert!(trade.is_buyer_maker);
    }

    #[test]
    fn test_kline_event_new() {
        let kline = KlineEvent::new(
            "btcusdt".to_string(),
            "1m".to_string(),
            50000.0,
            50100.0,
            49900.0,
            50050.0,
            100.0,
            1234567890000,
            1234567950000,
            true,
        );
        
        assert_eq!(kline.symbol, "btcusdt");
        assert_eq!(kline.timeframe, "1m");
        assert!(kline.is_closed);
    }

    #[test]
    fn test_market_event_symbol() {
        let trade = TradeEvent::new(
            "1".to_string(),
            "btcusdt".to_string(),
            50000.0,
            1.0,
            false,
            1234567890,
        );
        let event = MarketEvent::Trade(trade);
        assert_eq!(event.symbol(), "btcusdt");
    }
}
