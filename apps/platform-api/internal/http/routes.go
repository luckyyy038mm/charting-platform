package http

import (
	"context"

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

	// Market routes (placeholder for future implementation)
	market := api.Group("/market")
	market.Get("/symbols", s.handleListSymbols)
	market.Get("/symbols/:symbol", s.handleGetSymbol)
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

// App returns the fiber app instance
func (s *Server) App() *fiber.App {
	return s.app
}
