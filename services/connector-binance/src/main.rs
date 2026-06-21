mod binance;
mod config;
mod events;
mod trading;
mod valkey;

use anyhow::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::signal;
use tokio::time::{interval, Duration};
use tracing::{debug, error, info, Level};
use tracing_subscriber::FmtSubscriber;

use binance::BinanceWsClient;
use config::Config;
use events::{KlineEvent, MarketEvent, MarketStatusEvent, TradeEvent};
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
        let mut interval = interval(Duration::from_secs(30));
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

    // Check for mock mode (useful when Binance is geo-restricted)
    let use_mock = std::env::var("MOCK_MODE").unwrap_or_default().to_lowercase() == "true";
    
    if use_mock {
        info!("Running in MOCK mode - generating synthetic market data");
        run_mock_mode(publisher.clone(), config.symbols.clone()).await?;
    } else {
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

/// Run mock mode - generates synthetic market data for testing
async fn run_mock_mode(publisher: Arc<Publisher>, symbols: Vec<String>) -> Result<()> {
    use std::collections::HashMap;
    
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();
    
    // Handle shutdown
    tokio::spawn(async move {
        let _ = signal::ctrl_c().await;
        running_clone.store(false, Ordering::Relaxed);
    });

    // Base prices for BTC and ETH
    let mut prices: HashMap<String, f64> = symbols.iter()
        .zip(vec![65000.0, 3500.0].into_iter())
        .map(|(s, p)| (s.clone(), p))
        .collect();

    // Current candle state
    let mut candle_starts: HashMap<String, i64> = symbols.iter()
        .map(|s| (s.clone(), chrono::Utc::now().timestamp_millis() / 60000 * 60000))
        .collect();

    let mut candle_opens: HashMap<String, f64> = prices.clone();
    let mut candle_highs: HashMap<String, f64> = prices.clone();
    let mut candle_lows: HashMap<String, f64> = prices.clone();

    // Generate updates every 500ms
    let mut ticker = interval(Duration::from_millis(500));
    let mut trade_counter = 0i64;
    
    while running.load(Ordering::Relaxed) {
        ticker.tick().await;
        
        for symbol in &symbols {
            let price = prices.get_mut(symbol).unwrap();
            
            // Random walk price movement
            let change = (rand_simple() - 0.5) * (*price * 0.0005);
            *price += change;
            
            // Update candle
            let now = chrono::Utc::now().timestamp_millis();
            let candle_start = *candle_starts.get(symbol).unwrap();
            let candle_end = candle_start + 60000; // 1 minute
            
            if now >= candle_end {
                // Close current candle and start new one
                let open = *candle_opens.get(symbol).unwrap();
                let high = *candle_highs.get(symbol).unwrap();
                let low = *candle_lows.get(symbol).unwrap();
                let close = *price;
                
                // Publish closed candle
                let kline = KlineEvent::new(
                    symbol.clone(),
                    "1m".to_string(),
                    open, high, low, close,
                    rand_simple() * 100.0,
                    candle_start,
                    candle_end - 1,
                    true,
                );
                publisher.publish(&format!("market:{}", symbol), &MarketEvent::Kline(kline)).await?;
                
                // Start new candle
                *candle_starts.get_mut(symbol).unwrap() = candle_end;
                *candle_opens.get_mut(symbol).unwrap() = *price;
                *candle_highs.get_mut(symbol).unwrap() = *price;
                *candle_lows.get_mut(symbol).unwrap() = *price;
            } else {
                // Update current candle
                if *price > *candle_highs.get(symbol).unwrap() {
                    *candle_highs.get_mut(symbol).unwrap() = *price;
                }
                if *price < *candle_lows.get(symbol).unwrap() {
                    *candle_lows.get_mut(symbol).unwrap() = *price;
                }
                
                // Publish kline update
                let kline = KlineEvent::new(
                    symbol.clone(),
                    "1m".to_string(),
                    *candle_opens.get(symbol).unwrap(),
                    *candle_highs.get(symbol).unwrap(),
                    *candle_lows.get(symbol).unwrap(),
                    *price,
                    rand_simple() * 10.0,
                    candle_start,
                    candle_end - 1,
                    false,
                );
                publisher.publish(&format!("market:{}", symbol), &MarketEvent::Kline(kline)).await?;
            }
            
            // Publish trade every few ticks
            trade_counter += 1;
            if trade_counter % 3 == 0 {
                let trade = TradeEvent::new(
                    format!("m{}", trade_counter),
                    symbol.clone(),
                    *price,
                    rand_simple() * 2.0,
                    rand_simple() > 0.5,
                    now,
                );
                publisher.publish(&format!("market:{}", symbol), &MarketEvent::Trade(trade)).await?;
            }
        }
        
        debug!("Mock tick complete");
    }
    
    info!("Mock mode stopped");
    Ok(())
}

/// Simple pseudo-random number generator
fn rand_simple() -> f64 {
    use std::time::SystemTime;
    let seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    (seed as f64 % 1000.0) / 1000.0
}
