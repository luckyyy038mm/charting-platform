use anyhow::Result;
use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub valkey_url: String,
    pub log_level: String,
    pub service_name: String,
    pub supported_timeframes: Vec<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        Ok(Config {
            valkey_url: env::var("VALKEY_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            log_level: env::var("RUST_LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            service_name: env::var("RUST_SERVICE_NAME")
                .unwrap_or_else(|_| "market-core".to_string()),
            supported_timeframes: vec![
                "1m".to_string(),
                "5m".to_string(),
                "15m".to_string(),
                "1h".to_string(),
                "4h".to_string(),
                "1d".to_string(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_load_defaults() {
        let config = Config::load().unwrap();
        assert_eq!(config.service_name, "market-core");
        assert!(!config.supported_timeframes.is_empty());
    }
}
