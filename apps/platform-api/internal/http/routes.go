package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// Server represents the HTTP server
type Server struct {
	app       *fiber.App
	marketSvc MarketServiceProvider
}

// MarketServiceProvider interface for market service access
type MarketServiceProvider interface {
	GetSymbolSnapshot(ctx context.Context, symbol string) (map[string]interface{}, error)
}

// BinanceCandle represents a candle from Binance API
type BinanceCandle struct {
	OpenTime  int64   `json:"open_time"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
	CloseTime int64   `json:"close_time"`
}

// CandleResponse is the frontend candle format
type CandleResponse struct {
	Time      int64   `json:"time"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
	CloseTime int64   `json:"close_time"`
}

// NewServer creates a new HTTP server
func NewServer(marketSvc MarketServiceProvider) *Server {
	app := fiber.New(fiber.Config{
		AppName:      "Charting Platform API",
		ServerHeader: "charting-platform",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	// Middleware
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))

	server := &Server{
		app:       app,
		marketSvc: marketSvc,
	}

	server.setupRoutes()

	return server
}

func (s *Server) setupRoutes() {
	// Health routes
	s.app.Get("/health", s.handleHealth)
	s.app.Get("/ready", s.handleReady)

	// API v1 routes
	api := s.app.Group("/api")

	// System routes
	system := api.Group("/system")
	system.Get("/status", s.handleSystemStatus)

	// Market routes
	market := api.Group("/market")
	market.Get("/symbols", s.handleListSymbols)
	market.Get("/symbols/:symbol", s.handleGetSymbol)
	market.Get("/candles", s.handleGetCandles)
	market.Get("/ticker", s.handleGetTicker)
	market.Get("/orderbook", s.handleGetOrderBook)
	market.Get("/trades", s.handleGetRecentTrades)
}

// handleHealth returns server health status
func (s *Server) handleHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "healthy",
		"service": "charting-platform-api",
	})
}

// handleReady returns readiness status
func (s *Server) handleReady(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"ready": true,
	})
}

// handleSystemStatus returns detailed system status
func (s *Server) handleSystemStatus(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"service": "charting-platform-api",
		"version": "0.1.0",
		"status":  "running",
		"uptime":  "N/A", // Could add uptime tracking
		"features": fiber.Map{
			"websocket":    true,
			"market_data":  true,
			"workspaces":   "planned",
			"replay":       "planned",
			"paper_trade":  "planned",
		},
	})
}

// handleListSymbols returns list of available symbols
func (s *Server) handleListSymbols(c *fiber.Ctx) error {
	// Placeholder - would query database for available symbols
	symbols := []fiber.Map{
		{
			"symbol":        "BTCUSDT",
			"base_asset":    "BTC",
			"quote_asset":   "USDT",
			"exchange":      "binance_futures",
			"contract_type": "perpetual",
		},
		{
			"symbol":        "ETHUSDT",
			"base_asset":    "ETH",
			"quote_asset":   "USDT",
			"exchange":      "binance_futures",
			"contract_type": "perpetual",
		},
	}

	return c.JSON(fiber.Map{
		"symbols": symbols,
		"count":   len(symbols),
	})
}

// handleGetTicker returns 24hr ticker price change statistics
func (s *Server) handleGetTicker(c *fiber.Ctx) error {
	symbol := c.Query("symbol", "BTCUSDT")

	// Call Binance ticker endpoint
	url := fmt.Sprintf("https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=%s", symbol)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to fetch ticker: %v", err),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("Binance API returned status %d", resp.StatusCode),
		})
	}

	// Parse response directly
	var ticker map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&ticker); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to parse ticker: %v", err),
		})
	}

	return c.JSON(ticker)
}

// handleGetOrderBook returns order book depth
func (s *Server) handleGetOrderBook(c *fiber.Ctx) error {
	symbol := c.Query("symbol", "BTCUSDT")
	limit := c.QueryInt("limit", 10)

	if limit > 100 {
		limit = 100
	}

	// Call Binance depth endpoint
	url := fmt.Sprintf("https://fapi.binance.com/fapi/v1/depth?symbol=%s&limit=%d", symbol, limit)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to fetch order book: %v", err),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("Binance API returned status %d", resp.StatusCode),
		})
	}

	// Parse response directly
	var orderBook map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&orderBook); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to parse order book: %v", err),
		})
	}

	return c.JSON(orderBook)
}

// handleGetRecentTrades returns recent trades
func (s *Server) handleGetRecentTrades(c *fiber.Ctx) error {
	symbol := c.Query("symbol", "BTCUSDT")
	limit := c.QueryInt("limit", 50)

	if limit > 100 {
		limit = 100
	}

	// Call Binance trades endpoint
	url := fmt.Sprintf("https://fapi.binance.com/fapi/v1/trades?symbol=%s&limit=%d", symbol, limit)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to fetch trades: %v", err),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("Binance API returned status %d", resp.StatusCode),
		})
	}

	// Parse response directly
	var trades []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&trades); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to parse trades: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"symbol": symbol,
		"trades": trades,
		"count":  len(trades),
	})
}

// handleGetSymbol returns details for a specific symbol
func (s *Server) handleGetSymbol(c *fiber.Ctx) error {
	symbol := c.Params("symbol")

	// Placeholder - would query database for symbol details
	if symbol == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "symbol parameter required",
		})
	}

	return c.JSON(fiber.Map{
		"symbol":        symbol,
		"base_asset":    "BTC",
		"quote_asset":   "USDT",
		"exchange":      "binance_futures",
		"contract_type": "perpetual",
		"tick_size":     0.01,
		"lot_size":      0.001,
		"is_active":     true,
	})
}

// handleGetCandles returns historical klines/candles from Binance
func (s *Server) handleGetCandles(c *fiber.Ctx) error {
	symbol := c.Query("symbol", "BTCUSDT")
	timeframe := c.Query("interval", "1m")
	limit := c.QueryInt("limit", 100)

	// Map timeframe to Binance interval format
	binanceInterval := timeframe
	switch timeframe {
	case "1m":
		binanceInterval = "1m"
	case "5m":
		binanceInterval = "5m"
	case "15m":
		binanceInterval = "15m"
	case "1h":
		binanceInterval = "1h"
	case "4h":
		binanceInterval = "4h"
	case "1d":
		binanceInterval = "1d"
	case "1w":
		binanceInterval = "1w"
	default:
		binanceInterval = "1m"
	}

	// Call Binance API
	url := fmt.Sprintf("https://fapi.binance.com/fapi/v1/klines?symbol=%s&interval=%s&limit=%d", symbol, binanceInterval, limit)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to fetch candles: %v", err),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("Binance API returned status %d", resp.StatusCode),
		})
	}

	// Parse Binance klines response
	var rawCandles [][]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rawCandles); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to parse candles: %v", err),
		})
	}

	// Convert to our format
	candles := make([]CandleResponse, 0, len(rawCandles))
	for _, raw := range rawCandles {
		if len(raw) < 11 {
			continue
		}

		openTime, _ := toFloat64(raw[0])
		open, _ := toFloat64(raw[1])
		high, _ := toFloat64(raw[2])
		low, _ := toFloat64(raw[3])
		close, _ := toFloat64(raw[4])
		volume, _ := toFloat64(raw[5])
		closeTime, _ := toFloat64(raw[6])

		candles = append(candles, CandleResponse{
			Time:      int64(openTime),
			Open:      open,
			High:      high,
			Low:       low,
			Close:     close,
			Volume:    volume,
			CloseTime: int64(closeTime),
		})
	}

	return c.JSON(fiber.Map{
		"symbol":    symbol,
		"timeframe": timeframe,
		"candles":   candles,
		"count":     len(candles),
	})
}

// toFloat64 safely converts interface{} to float64
func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case json.Number:
		f, err := val.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

// App returns the fiber app instance
func (s *Server) App() *fiber.App {
	return s.app
}
