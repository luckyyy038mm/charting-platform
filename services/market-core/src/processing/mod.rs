//! Market data processing module.
//! Handles event normalization, aggregation, and state updates.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, info};

use crate::state::{Candle, MarketState, Timeframe, Trade};

/// Market event types from external sources
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MarketEvent {
    Trade(TradeEventData),
    Kline(KlineEventData),
    Depth(DepthEventData),
}

/// Trade event from connector
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TradeEventData {
    pub trade_id: String,
    pub symbol: String,
    pub price: f64,
    pub quantity: f64,
    pub quote_volume: f64,
    pub is_buyer_maker: bool,
    pub timestamp: i64,
}

/// Kline event from connector
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KlineEventData {
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
}

/// Depth event from connector
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepthEventData {
    pub symbol: String,
    pub bids: Vec<(f64, f64)>,
    pub asks: Vec<(f64, f64)>,
    pub last_update_id: i64,
    pub timestamp: i64,
}

/// Event processor for market data
pub struct EventProcessor {
    market_state: Arc<MarketState>,
    event_tx: broadcast::Sender<ProcessedEvent>,
}

impl EventProcessor {
    pub fn new(market_state: Arc<MarketState>) -> Self {
        let (event_tx, _) = broadcast::channel(1000);
        Self {
            market_state,
            event_tx,
        }
    }

    /// Process a raw market event
    pub fn process(&self, event: MarketEvent) -> Result<()> {
        match event {
            MarketEvent::Trade(data) => self.process_trade(data),
            MarketEvent::Kline(data) => self.process_kline(data),
            MarketEvent::Depth(data) => self.process_depth(data),
        }
    }

    /// Process a trade event
    fn process_trade(&self, data: TradeEventData) -> Result<()> {
        let symbol_state = self.market_state.get_or_create(&data.symbol);
        
        // Update price
        symbol_state.update_price(data.price);

        // Convert to internal trade format
        let trade = Trade {
            trade_id: data.trade_id,
            price: data.price,
            quantity: data.quantity,
            quote_volume: data.quote_volume,
            is_buyer_maker: data.is_buyer_maker,
            timestamp: data.timestamp,
        };

        // Add to state
        symbol_state.add_trade(trade);

        // Broadcast processed event
        let _ = self.event_tx.send(ProcessedEvent::Trade(data.clone()));

        debug!(
            symbol = %data.symbol,
            price = %data.price,
            "Trade processed"
        );

        Ok(())
    }

    /// Process a kline event
    fn process_kline(&self, data: KlineEventData) -> Result<()> {
        let symbol_state = self.market_state.get_or_create(&data.symbol);
        
        // Get or create timeframe
        let timeframe = match Timeframe::from_str(&data.timeframe) {
            Some(tf) => tf,
            None => {
                debug!(timeframe = %data.timeframe, "Unknown timeframe");
                return Ok(());
            }
        };

        // Convert to internal candle format
        let candle = Candle {
            open_time: data.open_time,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            quote_volume: data.quote_volume,
            trades_count: data.trades_count,
            close_time: data.close_time,
            is_closed: data.is_closed,
        };

        // Add to state
        symbol_state.add_candle(timeframe, candle);

        // Broadcast processed event
        let _ = self.event_tx.send(ProcessedEvent::Kline(data));

        debug!(
            symbol = %data.symbol,
            timeframe = %data.timeframe,
            is_closed = %data.is_closed,
            "Kline processed"
        );

        Ok(())
    }

    /// Process a depth event
    fn process_depth(&self, data: DepthEventData) -> Result<()> {
        let symbol_state = self.market_state.get_or_create(&data.symbol);

        // Update best bid/ask
        let best_bid = data.bids.first().map(|(p, q)| (*p, *q));
        let best_ask = data.asks.first().map(|(p, q)| (*p, *q));
        symbol_state.update_bid_ask(best_bid, best_ask);

        // Broadcast processed event
        let _ = self.event_tx.send(ProcessedEvent::Depth(data));

        debug!(
            symbol = %data.symbol,
            best_bid = ?best_bid,
            best_ask = ?best_ask,
            "Depth processed"
        );

        Ok(())
    }

    /// Subscribe to processed events
    pub fn subscribe(&self) -> broadcast::Receiver<ProcessedEvent> {
        self.event_tx.subscribe()
    }
}

/// Processed event types
#[derive(Debug, Clone)]
pub enum ProcessedEvent {
    Trade(TradeEventData),
    Kline(KlineEventData),
    Depth(DepthEventData),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_processor_trade() {
        let state = Arc::new(MarketState::new());
        let processor = EventProcessor::new(state.clone());

        let event = MarketEvent::Trade(TradeEventData {
            trade_id: "123".to_string(),
            symbol: "btcusdt".to_string(),
            price: 50000.0,
            quantity: 1.5,
            quote_volume: 75000.0,
            is_buyer_maker: false,
            timestamp: 1234567890,
        });

        processor.process(event).unwrap();

        let symbol_state = state.get("btcusdt").unwrap();
        assert_eq!(*symbol_state.last_price.read(), 50000.0);
    }
}
