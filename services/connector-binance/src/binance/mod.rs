pub mod ws_client;
pub use ws_client::BinanceWsClient;

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use tracing::{debug, info};

/// Binance REST API client for snapshots and historical data
pub struct BinanceRestClient {
    base_url: String,
    http_client: Client,
}

#[derive(Debug, Deserialize)]
pub struct ExchangeInfo {
    pub symbols: Vec<SymbolInfo>,
}

#[derive(Debug, Deserialize)]
pub struct SymbolInfo {
    pub symbol: String,
    pub status: String,
    #[serde(rename = "baseAsset")]
    pub base_asset: String,
    #[serde(rename = "quoteAsset")]
    pub quote_asset: String,
    #[serde(rename = "pricePrecision")]
    pub price_precision: i32,
    #[serde(rename = "qtyPrecision")]
    pub qty_precision: i32,
    #[serde(rename = "tickSize")]
    pub tick_size: String,
    #[serde(rename = "minQty")]
    pub min_qty: String,
    #[serde(rename = "maxQty")]
    pub max_qty: String,
}

#[derive(Debug, Deserialize)]
pub struct OrderBook {
    pub last_update_id: i64,
    pub bids: Vec<Vec<String>>,
    pub asks: Vec<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct Candlestick {
    pub open_time: i64,
    pub open: String,
    pub high: String,
    pub low: String,
    pub close: String,
    pub volume: String,
    pub close_time: i64,
    pub quote_volume: String,
    pub trades_count: i64,
    pub is_buyer_maker: bool,
    pub is_best_match: bool,
}

impl BinanceRestClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            http_client: Client::new(),
        }
    }

    /// Fetch exchange information (available symbols)
    pub async fn get_exchange_info(&self) -> Result<ExchangeInfo> {
        let url = format!("{}/fapi/v1/exchangeInfo", self.base_url);
        
        let response = self.http_client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch exchange info")?;
        
        let info: ExchangeInfo = response
            .json()
            .await
            .context("Failed to parse exchange info")?;
        
        debug!(symbols = info.symbols.len(), "Fetched exchange info");
        Ok(info)
    }

    /// Fetch order book depth for a symbol
    pub async fn get_order_book(&self, symbol: &str, limit: u32) -> Result<OrderBook> {
        let url = format!(
            "{}/fapi/v1/depth?symbol={}&limit={}",
            self.base_url, symbol.to_uppercase(), limit
        );
        
        let response = self.http_client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch order book")?;
        
        let order_book: OrderBook = response
            .json()
            .await
            .context("Failed to parse order book")?;
        
        debug!(
            symbol = %symbol,
            bids = order_book.bids.len(),
            asks = order_book.asks.len(),
            "Fetched order book"
        );
        
        Ok(order_book)
    }

    /// Fetch candlestick/kline data for a symbol
    pub async fn get_candlesticks(
        &self,
        symbol: &str,
        interval: &str,
        limit: u32,
    ) -> Result<Vec<Candlestick>> {
        let url = format!(
            "{}/fapi/v1/klines?symbol={}&interval={}&limit={}",
            self.base_url, symbol.to_uppercase(), interval, limit
        );
        
        let response = self.http_client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch candlesticks")?;
        
        let data: Vec<Vec<serde_json::Value>> = response
            .json()
            .await
            .context("Failed to parse candlesticks")?;
        
        let candlesticks: Vec<Candlestick> = data
            .into_iter()
            .map(|arr| Candlestick {
                open_time: arr[0].as_i64().unwrap_or(0),
                open: arr[1].as_str().unwrap_or("0").to_string(),
                high: arr[2].as_str().unwrap_or("0").to_string(),
                low: arr[3].as_str().unwrap_or("0").to_string(),
                close: arr[4].as_str().unwrap_or("0").to_string(),
                volume: arr[5].as_str().unwrap_or("0").to_string(),
                close_time: arr[6].as_i64().unwrap_or(0),
                quote_volume: arr[7].as_str().unwrap_or("0").to_string(),
                trades_count: arr[8].as_i64().unwrap_or(0),
                is_buyer_maker: arr[9].as_bool().unwrap_or(false),
                is_best_match: arr[10].as_bool().unwrap_or(false),
            })
            .collect();
        
        debug!(
            symbol = %symbol,
            interval = %interval,
            candles = candlesticks.len(),
            "Fetched candlesticks"
        );
        
        Ok(candlesticks)
    }

    /// Fetch recent trades for a symbol
    pub async fn get_recent_trades(&self, symbol: &str, limit: u32) -> Result<Vec<Trade>> {
        let url = format!(
            "{}/fapi/v1/trades?symbol={}&limit={}",
            self.base_url, symbol.to_uppercase(), limit
        );
        
        let response = self.http_client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch recent trades")?;
        
        let trades: Vec<Trade> = response
            .json()
            .await
            .context("Failed to parse trades")?;
        
        debug!(
            symbol = %symbol,
            trades = trades.len(),
            "Fetched recent trades"
        );
        
        Ok(trades)
    }
}

#[derive(Debug, Deserialize)]
pub struct Trade {
    pub id: i64,
    pub price: String,
    pub qty: String,
    pub quote_qty: String,
    pub time: i64,
    pub is_buyer_maker: bool,
}
