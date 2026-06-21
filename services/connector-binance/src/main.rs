mod binance;
mod config;
mod events;
mod trading;
mod valkey;

use anyhow::Result;
use std::sync::Arc;
use tokio::signal;
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

use binance::BinanceWsClient;
use config::Config;
use events::{MarketEvent, MarketStatusEvent};
use trading::MarketStateManager;
use valkey::Publisher;

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
        symbols = ?config.symbols,
        "Starting Binance connector service"
    );

    // Initialize Valkey publisher
    let publisher = Arc::new(Publisher::new(&config.valkey_url).await?);

    // Initialize market state manager (placeholder for future use)
    let _market_state = Arc::new(MarketStateManager::new());

    // Start heartbeat publisher
    let heartbeat_publisher = publisher.clone();
    let service_name = config.service_name.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let heartbeat_data = serde_json::json!({
                "service": service_name,
                "status": "running",
                "timestamp": chrono::Utc::now().timestamp_millis()
            });
            if let Err(e) = heartbeat_publisher
                .set_str(
                    &valkey::channels::heartbeat_key(&service_name),
                    &heartbeat_data.to_string(),
                    Some(60),
                )
                .await
            {
                error!(error = %e, "Failed to publish heartbeat");
            }
        }
    });

    // Publish service started status
    publisher
        .publish(
            "market:status",
            &MarketEvent::MarketStatus(MarketStatusEvent::new(
                "started",
                &format!("{} service started", config.service_name),
                None,
            )),
        )
        .await?;

    // Initialize Binance WebSocket client
    let ws_client = BinanceWsClient::new(
        &config.binance_ws_url,
        config.symbols.clone(),
        publisher.clone(),
    );

    // Handle shutdown signals
    let ws_client_for_shutdown = ws_client.clone();
    
    tokio::spawn(async move {
        ws_client_for_shutdown.stop();
    });

    // Wait for shutdown signal
    let shutdown = async {
        match signal::ctrl_c().await {
            Ok(()) => {
                info!("Received shutdown signal");
            }
            Err(e) => {
                error!(error = %e, "Failed to listen for shutdown signal");
            }
        }
    };

    // Run until shutdown
    tokio::select! {
        result = ws_client.start() => {
            if let Err(e) = result {
                error!(error = %e, "WebSocket client error");
            }
        }
        _ = shutdown => {
            info!("Shutting down...");
            ws_client.stop();
        }
    }

    // Publish service stopped status
    publisher
        .publish(
            "market:status",
            &MarketEvent::MarketStatus(MarketStatusEvent::new(
                "stopped",
                &format!("{} service stopped", config.service_name),
                None,
            )),
        )
        .await?;

    info!("Service stopped");
    Ok(())
}
