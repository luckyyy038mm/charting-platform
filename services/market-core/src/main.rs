mod config;
mod processing;
mod state;

use anyhow::Result;
use futures::StreamExt;
use std::sync::Arc;
use tokio::signal;
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

use crate::config::Config;
use crate::processing::EventProcessor;
use crate::state::MarketState;

#[tokio::main]
async fn main() -> Result<()> {
    // Load configuration
    let config = Config::load()?;

    // Initialize logging
    let log_level = match config.log_level.as_str() {
        "debug" => Level::DEBUG,
        "info" => Level::INFO,
        "warn" => Level::WARN,
        "error" => Level::ERROR,
        _ => Level::INFO,
    };

    let _subscriber = FmtSubscriber::builder()
        .with_max_level(log_level)
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .compact()
        .init();

    info!(
        service = %config.service_name,
        "Starting market-core service"
    );

    // Initialize market state
    let market_state = Arc::new(MarketState::new());

    // Initialize event processor
    let processor = Arc::new(EventProcessor::new(market_state.clone()));

    info!("Market-core service initialized");

    // Wait for shutdown signal
    tokio::select! {
        _ = signal::ctrl_c() => {
            info!("Received shutdown signal");
        }
    }

    info!("Market-core service stopped");
    Ok(())
}
