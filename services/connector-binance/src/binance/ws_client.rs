use anyhow::{Context, Result};
use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};
use tracing::{debug, error, info, warn};

use crate::events::{
    DepthEvent, KlineEvent, MarketEvent, MarketEventType, TradeEvent, MarketStatusEvent,
};
use crate::valkey::Publisher;

/// Binance WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "e")]
pub struct WsMessage {
    #[serde(rename = "e")]
    pub event_type: String,
    #[serde(rename = "E")]
    pub event_time: i64,
    #[serde(rename = "s")]
    pub symbol: String,
}

/// Trade event from Binance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsTrade {
    #[serde(rename = "e")]
    pub event_type: String,
    #[serde(rename = "E")]
    pub event_time: i64,
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "t")]
    pub trade_id: i64,
    #[serde(rename = "p")]
    pub price: String,
    #[serde(rename = "q")]
    pub quantity: String,
    #[serde(rename = "b")]
    pub buyer_order_id: i64,
    #[serde(rename = "a")]
    pub seller_order_id: i64,
    #[serde(rename = "T")]
    pub trade_time: i64,
    #[serde(rename = "m")]
    pub is_buyer_maker: bool,
    #[serde(rename = "M")]
    pub is_best_match: bool,
}

/// Kline/Candlestick event from Binance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsKline {
    #[serde(rename = "e")]
    pub event_type: String,
    #[serde(rename = "E")]
    pub event_time: i64,
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "k")]
    pub kline: KlineData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KlineData {
    #[serde(rename = "t")]
    pub open_time: i64,
    #[serde(rename = "T")]
    pub close_time: i64,
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "i")]
    pub interval: String,
    #[serde(rename = "f")]
    pub first_trade_id: i64,
    #[serde(rename = "L")]
    pub last_trade_id: i64,
    #[serde(rename = "o")]
    pub open: String,
    #[serde(rename = "c")]
    pub close: String,
    #[serde(rename = "h")]
    pub high: String,
    #[serde(rename = "l")]
    pub low: String,
    #[serde(rename = "v")]
    pub volume: String,
    #[serde(rename = "n")]
    pub trades_count: i64,
    #[serde(rename = "x")]
    pub is_closed: bool,
    #[serde(rename = "q")]
    pub quote_volume: String,
    #[serde(rename = "V")]
    pub taker_buy_volume: String,
    #[serde(rename = "Q")]
    pub taker_buy_quote_volume: String,
}

/// Partial book depth event from Binance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsDepth {
    #[serde(rename = "e")]
    pub event_type: String,
    #[serde(rename = "E")]
    pub event_time: i64,
    #[serde(rename = "U")]
    pub first_update_id: i64,
    #[serde(rename = "u")]
    pub final_update_id: i64,
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "b")]
    pub bids: Vec<DepthLevel>,
    #[serde(rename = "a")]
    pub asks: Vec<DepthLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepthLevel {
    #[serde(rename = "0")]
    pub price: String,
    #[serde(rename = "1")]
    pub quantity: String,
}

/// 24hr ticker event from Binance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsTicker {
    #[serde(rename = "e")]
    pub event_type: String,
    #[serde(rename = "E")]
    pub event_time: i64,
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "p")]
    pub price_change: String,
    #[serde(rename = "P")]
    pub price_change_percent: String,
    #[serde(rename = "c")]
    pub last_price: String,
    #[serde(rename = "h")]
    pub high_price: String,
    #[serde(rename = "l")]
    pub low_price: String,
    #[serde(rename = "v")]
    pub volume: String,
    #[serde(rename = "q")]
    pub quote_volume: String,
}

/// Binance WebSocket client
#[derive(Clone)]
pub struct BinanceWsClient {
    url: String,
    symbols: Vec<String>,
    publisher: Arc<Publisher>,
    shutdown_tx: broadcast::Sender<()>,
    state: Arc<RwLock<ClientState>>,
}

#[derive(Debug)]
struct ClientState {
    connected: bool,
    reconnecting: bool,
}

impl BinanceWsClient {
    pub fn new(url: &str, symbols: Vec<String>, publisher: Arc<Publisher>) -> Self {
        let (shutdown_tx, _) = broadcast::channel(1);
        
        Self {
            url: url.to_string(),
            symbols,
            publisher,
            shutdown_tx,
            state: Arc::new(RwLock::new(ClientState {
                connected: false,
                reconnecting: false,
            })),
        }
    }

    /// Start the WebSocket client
    pub async fn start(&self) -> Result<()> {
        info!(
            symbols = ?self.symbols,
            url = %self.url,
            "Starting Binance WebSocket client"
        );

        // Build the subscription stream URL
        let streams = self.build_stream_url();
        let ws_url = format!("{}/{}", self.url.trim_end_matches('/'), streams);
        
        info!(url = %ws_url, "Connecting to WebSocket stream");

        loop {
            match connect_async(&ws_url).await {
                Ok((ws_stream, _)) => {
                    info!("Connected to Binance WebSocket");
                    {
                        let mut state = self.state.write().await;
                        state.connected = true;
                        state.reconnecting = false;
                    }

                    if let Err(e) = self.handle_connection(ws_stream).await {
                        error!(error = %e, "WebSocket connection error");
                    }

                    // Publish disconnect status
                    let _ = self.publisher.publish(
                        "market:status",
                        &MarketEvent::MarketStatus(MarketStatusEvent::new(
                            "disconnected",
                            "WebSocket disconnected, will reconnect",
                            None,
                        )),
                    ).await;
                }
                Err(e) => {
                    error!(error = %e, "Failed to connect to Binance WebSocket");
                }
            }

            // Check for shutdown signal
            if self.shutdown_tx.try_recv().is_ok() {
                info!("Shutdown signal received");
                break;
            }

            // Wait before reconnecting
            {
                let mut state = self.state.write().await;
                state.connected = false;
                state.reconnecting = true;
            }
            
            info!("Reconnecting in 5 seconds...");
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }

        Ok(())
    }

    /// Handle an established WebSocket connection
    async fn handle_connection(
        &self,
        ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
    ) -> Result<()> {
        let (mut write, mut read) = ws_stream.split();

        // Send ping periodically
        let ping_handle = tokio::spawn({
            let mut shutdown = self.shutdown_tx.subscribe();
            async move {
                loop {
                    tokio::select! {
                        _ = tokio::time::sleep(tokio::time::Duration::from_secs(30)) => {
                            if write.send(Message::Ping(vec![].into())).await.is_err() {
                                break;
                            }
                        }
                        _ = shutdown.recv() => {
                            break;
                        }
                    }
                }
            }
        });

        // Process incoming messages
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Err(e) = self.process_message(&text).await {
                        debug!(error = %e, "Failed to process message");
                    }
                }
                Ok(Message::Ping(data)) => {
                    let _ = write.send(Message::Pong(data)).await;
                }
                Ok(Message::Close(_)) => {
                    warn!("WebSocket closed by server");
                    break;
                }
                Err(e) => {
                    error!(error = %e, "WebSocket read error");
                    break;
                }
                _ => {}
            }
        }

        let _ = ping_handle.abort();
        Ok(())
    }

    /// Process an incoming WebSocket message
    async fn process_message(&self, text: &str) -> Result<()> {
        // Try to determine message type by parsing the event type field
        if text.contains("\"e\":\"trade\"") {
            self.handle_trade(text).await?;
        } else if text.contains("\"e\":\"kline\"") {
            self.handle_kline(text).await?;
        } else if text.contains("\"e\":\"depthUpdate\"") {
            self.handle_depth(text).await?;
        } else if text.contains("\"e\":\"24hrTicker\"") {
            self.handle_ticker(text).await?;
        }
        
        Ok(())
    }

    /// Handle a trade event
    async fn handle_trade(&self, text: &str) -> Result<()> {
        let ws_trade: WsTrade = serde_json::from_str(text)
            .context("Failed to parse trade event")?;
        
        let symbol = ws_trade.symbol.to_lowercase();
        let price: f64 = ws_trade.price.parse().unwrap_or(0.0);
        let quantity: f64 = ws_trade.quantity.parse().unwrap_or(0.0);

        let trade_event = TradeEvent::new(
            ws_trade.trade_id.to_string(),
            symbol.clone(),
            price,
            quantity,
            ws_trade.is_buyer_maker,
            ws_trade.trade_time,
        );

        let market_event = MarketEvent::Trade(trade_event);
        
        // Publish to symbol channel
        self.publisher.publish(&format!("market:{}", symbol), &market_event).await?;
        
        // Also publish to trade-specific channel
        self.publisher.publish(&format!("market:{}:trade", symbol), &market_event).await?;

        debug!(
            symbol = %symbol,
            price = %price,
            quantity = %quantity,
            "Trade event processed"
        );

        Ok(())
    }

    /// Handle a kline/candlestick event
    async fn handle_kline(&self, text: &str) -> Result<()> {
        let ws_kline: WsKline = serde_json::from_str(text)
            .context("Failed to parse kline event")?;
        
        let symbol = ws_kline.symbol.to_lowercase();
        let kline = &ws_kline.kline;
        
        let kline_event = KlineEvent::new(
            symbol.clone(),
            kline.interval.clone(),
            kline.open.parse().unwrap_or(0.0),
            kline.high.parse().unwrap_or(0.0),
            kline.low.parse().unwrap_or(0.0),
            kline.close.parse().unwrap_or(0.0),
            kline.volume.parse().unwrap_or(0.0),
            kline.open_time,
            kline.close_time,
            kline.is_closed,
        );

        let market_event = MarketEvent::Kline(kline_event);
        
        // Publish to symbol channel
        self.publisher.publish(&format!("market:{}", symbol), &market_event).await?;
        
        // Also publish to kline-specific channel
        self.publisher.publish(
            &format!("market:{}:kline:{}", symbol, kline.interval),
            &market_event,
        ).await?;

        debug!(
            symbol = %symbol,
            timeframe = %kline.interval,
            is_closed = %kline.is_closed,
            "Kline event processed"
        );

        Ok(())
    }

    /// Handle a depth update event
    async fn handle_depth(&self, text: &str) -> Result<()> {
        let ws_depth: WsDepth = serde_json::from_str(text)
            .context("Failed to parse depth event")?;
        
        let symbol = ws_depth.symbol.to_lowercase();
        
        let bids: Vec<(f64, f64)> = ws_depth.bids
            .iter()
            .filter_map(|level| {
                let price: f64 = level.price.parse().ok()?;
                let qty: f64 = level.quantity.parse().ok()?;
                Some((price, qty))
            })
            .collect();

        let asks: Vec<(f64, f64)> = ws_depth.asks
            .iter()
            .filter_map(|level| {
                let price: f64 = level.price.parse().ok()?;
                let qty: f64 = level.quantity.parse().ok()?;
                Some((price, qty))
            })
            .collect();

        let depth_event = DepthEvent {
            symbol: symbol.clone(),
            bids,
            asks,
            last_update_id: ws_depth.final_update_id,
            timestamp: ws_depth.event_time,
            exchange: "binance_futures".to_string(),
        };

        let market_event = MarketEvent::Depth(depth_event);
        
        // Publish to symbol channel
        self.publisher.publish(&format!("market:{}", symbol), &market_event).await?;
        
        // Also publish to depth-specific channel
        self.publisher.publish(&format!("market:{}:depth", symbol), &market_event).await?;

        debug!(
            symbol = %symbol,
            bids = %ws_depth.bids.len(),
            asks = %ws_depth.asks.len(),
            "Depth event processed"
        );

        Ok(())
    }

    /// Handle a 24hr ticker event
    async fn handle_ticker(&self, text: &str) -> Result<()> {
        let ws_ticker: WsTicker = serde_json::from_str(text)
            .context("Failed to parse ticker event")?;
        
        let symbol = ws_ticker.symbol.to_lowercase();

        // Publish to symbol channel
        self.publisher.publish(&format!("market:{}", symbol), &MarketEvent::Ticker(crate::events::TickerEvent {
            symbol: symbol.clone(),
            price_change: ws_ticker.price_change.parse().unwrap_or(0.0),
            price_change_percent: ws_ticker.price_change_percent.parse().unwrap_or(0.0),
            last_price: ws_ticker.last_price.parse().unwrap_or(0.0),
            high_price: ws_ticker.high_price.parse().unwrap_or(0.0),
            low_price: ws_ticker.low_price.parse().unwrap_or(0.0),
            volume: ws_ticker.volume.parse().unwrap_or(0.0),
            quote_volume: ws_ticker.quote_volume.parse().unwrap_or(0.0),
            timestamp: ws_ticker.event_time,
            exchange: "binance_futures".to_string(),
        })).await?;

        debug!(
            symbol = %symbol,
            last_price = %ws_ticker.last_price,
            "Ticker event processed"
        );

        Ok(())
    }

    /// Build the WebSocket stream URL with subscribed streams
    fn build_stream_url(&self) -> String {
        let streams: Vec<String> = self.symbols
            .iter()
            .flat_map(|symbol| {
                vec![
                    format!("{}@trade", symbol),
                    format!("{}@kline_1m", symbol),
                    format!("{}@depth@100ms", symbol),
                    format!("{}@ticker", symbol),
                ]
            })
            .collect();
        
        streams.join("/")
    }

    /// Stop the WebSocket client
    pub fn stop(&self) {
        let _ = self.shutdown_tx.send(());
    }
}
