use anyhow::Result;
use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub binance_ws_url: String,
    pub binance_rest_url: String,
    pub valkey_url: String,
    pub log_level: String,
    pub service_name: String,
    pub symbols: Vec<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        Ok(Config {
            binance_ws_url: env::var("BINANCE_FUTURES_WS_URL")
                .unwrap_or_else(|_| "wss://stream.binance.com:9443/ws".to_string()),
            binance_rest_url: env::var("BINANCE_FUTURES_REST_URL")
                .unwrap_or_else(|_| "https://fapi.binance.com".to_string()),
            valkey_url: env::var("VALKEY_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            log_level: env::var("RUST_LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            service_name: env::var("RUST_SERVICE_NAME")
                .unwrap_or_else(|_| "connector-binance".to_string()),
            symbols: env::var("SYMBOLS")
                .unwrap_or_else(|_| "btcusdt,ethusdt".to_string())
                .split(',')
                .map(|s| s.trim().to_lowercase())
                .collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_load_defaults() {
        let config = Config::load().unwrap();
        assert_eq!(config.symbols, vec!["btcusdt", "ethusdt"]);
    }
}
