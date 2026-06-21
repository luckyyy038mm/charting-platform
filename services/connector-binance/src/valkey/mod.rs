use anyhow::{Context, Result};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

/// Valkey publisher for market events
pub struct Publisher {
    conn: Arc<RwLock<ConnectionManager>>,
    url: String,
}

impl Publisher {
    /// Create a new publisher connection
    pub async fn new(url: &str) -> Result<Self> {
        info!(url = %url, "Connecting to Valkey");
        
        let client = redis::Client::open(url)
            .context("Failed to create Redis client")?;
        
        let conn = ConnectionManager::new(client)
            .await
            .context("Failed to establish Redis connection")?;

        info!("Connected to Valkey");
        
        Ok(Self {
            conn: Arc::new(RwLock::new(conn)),
            url: url.to_string(),
        })
    }

    /// Publish a message to a channel
    pub async fn publish<T: Serialize>(&self, channel: &str, message: &T) -> Result<()> {
        let data = serde_json::to_string(message)
            .context("Failed to serialize message")?;
        
        let mut conn = self.conn.write().await;
        conn.publish::<_, _, ()>(channel, data).await
            .context("Failed to publish message")?;
        
        debug!(channel = %channel, "Published message");
        Ok(())
    }

    /// Publish a raw message to a channel
    pub async fn publish_raw(&self, channel: &str, message: &str) -> Result<()> {
        let mut conn = self.conn.write().await;
        conn.publish::<_, _, ()>(channel, message).await
            .context("Failed to publish raw message")?;
        
        debug!(channel = %channel, "Published raw message");
        Ok(())
    }

    /// Set a key with optional expiration
    pub async fn set<K, V>(&self, key: &str, value: &V, expiration_secs: Option<u64>) -> Result<()> 
    where
        K: AsRef<str>,
        V: Serialize,
    {
        let data = serde_json::to_string(value)
            .context("Failed to serialize value")?;
        
        let mut conn = self.conn.write().await;
        
        match expiration_secs {
            Some(secs) => {
                conn.set_ex::<_, _, ()>(key, data, secs).await
                    .context("Failed to set key with expiration")?;
            }
            None => {
                conn.set::<_, _, ()>(key, data).await
                    .context("Failed to set key")?;
            }
        }
        
        debug!(key = %key, "Set key");
        Ok(())
    }

    /// Set a string key with optional expiration
    pub async fn set_str(&self, key: &str, value: &str, expiration_secs: Option<u64>) -> Result<()> {
        let mut conn = self.conn.write().await;
        
        match expiration_secs {
            Some(secs) => {
                conn.set_ex::<_, _, ()>(key, value, secs).await
                    .context("Failed to set key with expiration")?;
            }
            None => {
                conn.set::<_, _, ()>(key, value).await
                    .context("Failed to set key")?;
            }
        }
        
        debug!(key = %key, "Set string key");
        Ok(())
    }

    /// Get a value by key
    pub async fn get<K, V>(&self, key: &str) -> Result<Option<V>>
    where
        K: AsRef<str>,
        V: DeserializeOwned,
    {
        let mut conn = self.conn.write().await;
        let data: Option<String> = conn.get(key).await
            .context("Failed to get key")?;
        
        match data {
            Some(d) => {
                let value: V = serde_json::from_str(&d)
                    .context("Failed to deserialize value")?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    /// Check if Valkey is healthy
    pub async fn health_check(&self) -> Result<()> {
        let mut conn = self.conn.write().await;
        let _: String = redis::cmd("PING")
            .query_async(&mut *conn)
            .await
            .context("Health check failed")?;
        Ok(())
    }

    /// Reconnect if connection is lost
    pub async fn reconnect(&mut self) -> Result<()> {
        info!("Reconnecting to Valkey");
        
        let client = redis::Client::open(self.url.as_str())
            .context("Failed to create Redis client")?;
        
        let conn = ConnectionManager::new(client)
            .await
            .context("Failed to establish Redis connection")?;
        
        *self.conn.write().await = conn;
        
        info!("Reconnected to Valkey");
        Ok(())
    }
}

/// Market channel naming conventions
pub mod channels {
    /// Get the channel name for a specific symbol
    pub fn symbol_channel(symbol: &str) -> String {
        format!("market:{}", symbol)
    }

    /// Get the channel name for all market events
    pub fn all_markets_channel() -> &'static str {
        "market:*"
    }

    /// Get the channel name for trade events
    pub fn trade_channel(symbol: &str) -> String {
        format!("market:{}:trade", symbol)
    }

    /// Get the channel name for kline events
    pub fn kline_channel(symbol: &str, timeframe: &str) -> String {
        format!("market:{}:kline:{}", symbol, timeframe)
    }

    /// Get the channel name for depth events
    pub fn depth_channel(symbol: &str) -> String {
        format!("market:{}:depth", symbol)
    }

    /// Get the snapshot key for a symbol
    pub fn snapshot_key(symbol: &str) -> String {
        format!("snapshot:{}", symbol)
    }

    /// Get the service heartbeat key
    pub fn heartbeat_key(service_name: &str) -> String {
        format!("heartbeat:{}", service_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_symbol_channel() {
        assert_eq!(channels::symbol_channel("btcusdt"), "market:btcusdt");
    }

    #[test]
    fn test_trade_channel() {
        assert_eq!(channels::trade_channel("ethusdt"), "market:ethusdt:trade");
    }

    #[test]
    fn test_kline_channel() {
        assert_eq!(
            channels::kline_channel("btcusdt", "1m"),
            "market:btcusdt:kline:1m"
        );
    }

    #[test]
    fn test_snapshot_key() {
        assert_eq!(channels::snapshot_key("btcusdt"), "snapshot:btcusdt");
    }

    #[test]
    fn test_heartbeat_key() {
        assert_eq!(channels::heartbeat_key("connector-binance"), "heartbeat:connector-binance");
    }
}
