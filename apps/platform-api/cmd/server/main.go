package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/charting-platform/platform-api/internal/config"
	"github.com/charting-platform/platform-api/internal/http"
	"github.com/charting-platform/platform-api/internal/market"
	"github.com/charting-platform/platform-api/internal/valkey"
	ws "github.com/gofiber/contrib/websocket"
	"github.com/charting-platform/platform-api/internal/websocket"
	"github.com/charting-platform/platform-api/pkg/logger"
	"github.com/gofiber/fiber/v2"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	logger.Init(cfg.Logging.Level)
	log := logger.Get()

	log.Info().Msg("Starting Charting Platform API")

	// Initialize Valkey client
	valkeyClient, err := valkey.NewClient(cfg.Valkey)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Valkey")
	}
	log.Info().Msg("Valkey client initialized")

	// Initialize market service
	marketService := market.NewMarketService(valkeyClient)

	// Initialize HTTP server
	server := http.NewServer(marketService)

	// Initialize WebSocket gateway
	wsGateway := websocket.NewGateway(marketService)

	// Mount WebSocket route
	server.App().Use("/ws", func(c *fiber.Ctx) error {
		if ws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	server.App().Get("/ws", ws.New(wsGateway.HandleConnection))

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
		log.Info().Str("address", addr).Msg("Starting HTTP server")
		if err := server.App().Listen(addr); err != nil {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	<-quit
	log.Info().Msg("Shutting down server...")

	if err := server.App().Shutdown(); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
	}

	// Cleanup
	marketService.Close()
	wsGateway.Close()
	valkeyClient.Close()

	log.Info().Msg("Server stopped")
}
