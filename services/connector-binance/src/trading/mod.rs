use crate::events::{DepthEvent, KlineEvent, TradeEvent};
use dashmap::DashMap;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;

/// Symbol state containing the latest market data for a symbol
pub struct SymbolState {
    pub symbol: String,
    pub last_trade: RwLock<Option<TradeEvent>>,
    pub current_kline: RwLock<Option<KlineEvent>>,
    pub depth: RwLock<OrderBookState>,
    pub recent_trades: RwLock<Vec<TradeEvent>>,
    pub recent_klines: RwLock<Vec<KlineEvent>>,
    // Future placeholders
    pub footprint_state: RwLock<Option<()>>, // Placeholder for footprint data
    pub heatmap_state: RwLock<Option<()>>,   // Placeholder for heatmap data
}

impl SymbolState {
    pub fn new(symbol: String) -> Self {
        Self {
            symbol,
            last_trade: RwLock::new(None),
            current_kline: RwLock::new(None),
            depth: RwLock::new(OrderBookState::default()),
            recent_trades: RwLock::new(Vec::new()),
            recent_klines: RwLock::new(Vec::new()),
            footprint_state: RwLock::new(None),
            heatmap_state: RwLock::new(None),
        }
    }

    /// Update with a new trade
    pub fn update_trade(&self, trade: TradeEvent) {
        *self.last_trade.write() = Some(trade.clone());
        
        let mut recent = self.recent_trades.write();
        recent.push(trade);
        if recent.len() > 100 {
            recent.remove(0);
        }
    }

    /// Update with a new kline
    pub fn update_kline(&self, kline: KlineEvent) {
        let mut current = self.current_kline.write();
        *current = Some(kline.clone());
        
        let mut recent = self.recent_klines.write();
        recent.push(kline);
        if recent.len() > 100 {
            recent.remove(0);
        }
    }

    /// Update depth/level2 data
    pub fn update_depth(&self, depth: DepthEvent) {
        let mut state = self.depth.write();
        state.update(depth);
    }

    /// Get the latest trade
    pub fn get_last_trade(&self) -> Option<TradeEvent> {
        self.last_trade.read().clone()
    }

    /// Get the current kline
    pub fn get_current_kline(&self) -> Option<KlineEvent> {
        self.current_kline.read().clone()
    }

    /// Get recent trades
    pub fn get_recent_trades(&self, count: usize) -> Vec<TradeEvent> {
        let recent = self.recent_trades.read();
        recent.iter().rev().take(count).cloned().collect()
    }

    /// Get recent klines
    pub fn get_recent_klines(&self, count: usize) -> Vec<KlineEvent> {
        let recent = self.recent_klines.read();
        recent.iter().rev().take(count).cloned().collect()
    }

    /// Get best bid/ask
    pub fn get_best_bid_ask(&self) -> Option<(f64, f64)> {
        let depth = self.depth.read();
        let best_bid = depth.bids.first().map(|(p, _)| *p);
        let best_ask = depth.asks.first().map(|(p, _)| *p);
        
        match (best_bid, best_ask) {
            (Some(bid), Some(ask)) => Some((bid, ask)),
            _ => None,
        }
    }
}

/// Order book state
#[derive(Debug, Clone)]
pub struct OrderBookState {
    pub bids: Vec<(f64, f64)>, // (price, quantity)
    pub asks: Vec<(f64, f64)>,
    pub last_update_id: i64,
}

impl Default for OrderBookState {
    fn default() -> Self {
        Self {
            bids: Vec::new(),
            asks: Vec::new(),
            last_update_id: 0,
        }
    }
}

impl OrderBookState {
    pub fn update(&mut self, depth: DepthEvent) {
        // Update bids
        for &(price, qty) in &depth.bids {
            if qty == 0.0 {
                self.bids.retain(|(p, _)| *p != price);
            } else {
                if let Some(existing) = self.bids.iter_mut().find(|(p, _)| *p == price) {
                    existing.1 = qty;
                } else {
                    self.bids.push((price, qty));
                }
            }
        }
        
        // Update asks
        for &(price, qty) in &depth.asks {
            if qty == 0.0 {
                self.asks.retain(|(p, _)| *p != price);
            } else {
                if let Some(existing) = self.asks.iter_mut().find(|(p, _)| *p == price) {
                    existing.1 = qty;
                } else {
                    self.asks.push((price, qty));
                }
            }
        }
        
        // Sort bids descending by price
        self.bids.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        // Sort asks ascending by price
        self.asks.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        
        // Keep only top N levels
        let max_levels = 100;
        self.bids.truncate(max_levels);
        self.asks.truncate(max_levels);
        
        self.last_update_id = depth.last_update_id;
    }
}

/// Market state manager for all symbols
pub struct MarketStateManager {
    symbols: Arc<DashMap<String, Arc<SymbolState>>>,
}

impl MarketStateManager {
    pub fn new() -> Self {
        Self {
            symbols: Arc::new(DashMap::new()),
        }
    }

    /// Register a new symbol
    pub fn register_symbol(&self, symbol: &str) -> Arc<SymbolState> {
        let state = Arc::new(SymbolState::new(symbol.to_string()));
        self.symbols.insert(symbol.to_string(), state.clone());
        state
    }

    /// Get or create a symbol state
    pub fn get_or_create(&self, symbol: &str) -> Arc<SymbolState> {
        self.symbols
            .entry(symbol.to_string())
            .or_insert_with(|| Arc::new(SymbolState::new(symbol.to_string())))
            .clone()
    }

    /// Get a symbol state if it exists
    pub fn get(&self, symbol: &str) -> Option<Arc<SymbolState>> {
        self.symbols.get(symbol).map(|r| r.clone())
    }

    /// Check if a symbol is registered
    pub fn contains(&self, symbol: &str) -> bool {
        self.symbols.contains_key(symbol)
    }

    /// Get all registered symbols
    pub fn symbols(&self) -> Vec<String> {
        self.symbols.iter().map(|r| r.key().clone()).collect()
    }

    /// Update trade for a symbol
    pub fn update_trade(&self, symbol: &str, trade: TradeEvent) {
        let state = self.get_or_create(symbol);
        state.update_trade(trade);
    }

    /// Update kline for a symbol
    pub fn update_kline(&self, symbol: &str, kline: KlineEvent) {
        let state = self.get_or_create(symbol);
        state.update_kline(kline);
    }

    /// Update depth for a symbol
    pub fn update_depth(&self, symbol: &str, depth: DepthEvent) {
        let state = self.get_or_create(symbol);
        state.update_depth(depth);
    }
}

impl Default for MarketStateManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_symbol_state_trade() {
        let state = SymbolState::new("btcusdt".to_string());
        
        let trade = TradeEvent::new(
            "1".to_string(),
            "btcusdt".to_string(),
            50000.0,
            1.0,
            false,
            1234567890,
        );
        
        state.update_trade(trade.clone());
        
        assert_eq!(state.get_last_trade(), Some(trade));
    }

    #[test]
    fn test_order_book_state_update() {
        let mut state = OrderBookState::default();
        
        let depth = DepthEvent {
            symbol: "btcusdt".to_string(),
            bids: vec![(50000.0, 10.0), (49900.0, 5.0)],
            asks: vec![(50100.0, 8.0), (50200.0, 3.0)],
            last_update_id: 1,
            timestamp: 1234567890,
            exchange: "binance_futures".to_string(),
        };
        
        state.update(depth);
        
        assert_eq!(state.bids.len(), 2);
        assert_eq!(state.asks.len(), 2);
        assert_eq!(state.bids[0].0, 50000.0); // Descending by price
        assert_eq!(state.asks[0].0, 50100.0); // Ascending by price
    }

    #[test]
    fn test_market_state_manager() {
        let manager = MarketStateManager::new();
        
        manager.register_symbol("btcusdt");
        assert!(manager.contains("btcusdt"));
        assert!(!manager.contains("ethusdt"));
        
        let symbols = manager.symbols();
        assert_eq!(symbols, vec!["btcusdt"]);
    }
}
