package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/charting-platform/platform-api/internal/market"
	"github.com/charting-platform/platform-api/pkg/logger"
	ws "github.com/gofiber/contrib/websocket"
)

const (
	// Channel types for WebSocket messaging
	ChannelMarket   = "market"
	ChannelControl  = "control"
	ChannelSnapshot = "snapshot"
)

// Client represents a WebSocket client connection
type Client struct {
	ID       string
	Conn     *ws.Conn
	Channels map[string]bool
	mu       sync.RWMutex
}

// Gateway manages WebSocket connections and message routing
type Gateway struct {
	clients        map[string]*Client
	marketService  *market.MarketService
	subscriptions  map[string]map[string]bool // clientID -> set of subscribed symbols
	mu             sync.RWMutex
	ctx            context.Context
	cancel         context.CancelFunc
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type    string          `json:"type"`
	Channel string          `json:"channel,omitempty"`
	Symbol  string          `json:"symbol,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// WSResponse represents a WebSocket response
type WSResponse struct {
	Type    string      `json:"type"`
	Channel string      `json:"channel"`
	Symbol  string      `json:"symbol,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// NewGateway creates a new WebSocket gateway
func NewGateway(marketSvc *market.MarketService) *Gateway {
	ctx, cancel := context.WithCancel(context.Background())
	return &Gateway{
		clients:       make(map[string]*Client),
		marketService: marketSvc,
		subscriptions: make(map[string]map[string]bool),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// HandleConnection handles a new WebSocket connection
func (g *Gateway) HandleConnection(c *ws.Conn) {
	clientID := fmt.Sprintf("client_%d", time.Now().UnixNano())
	
	client := &Client{
		ID:       clientID,
		Conn:     c,
		Channels: make(map[string]bool),
	}

	g.mu.Lock()
	g.clients[clientID] = client
	g.subscriptions[clientID] = make(map[string]bool)
	g.mu.Unlock()

	logger.Info().Str("client_id", clientID).Msg("New WebSocket connection")

	// Send welcome message
	g.sendToClient(client, WSResponse{
		Type:    "connected",
		Channel: ChannelControl,
		Data: map[string]interface{}{
			"client_id": clientID,
			"message":   "Connected to charting platform",
		},
	})

	// Start market data subscription if client subscribes
	go g.forwardMarketEvents(client)

	// Handle incoming messages
	defer func() {
		g.disconnectClient(clientID)
	}()

	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			logger.Info().Err(err).Str("client_id", clientID).Msg("WebSocket read error")
			break
		}

		g.handleMessage(client, msg)
	}
}

func (g *Gateway) handleMessage(client *Client, msg []byte) {
	var message WSMessage
	if err := json.Unmarshal(msg, &message); err != nil {
		logger.Warn().Err(err).Str("client_id", client.ID).Msg("Failed to parse message")
		g.sendToClient(client, WSResponse{
			Type:    "error",
			Channel: ChannelControl,
			Data:    map[string]string{"error": "Invalid message format"},
		})
		return
	}

	switch message.Type {
	case "subscribe":
		g.handleSubscribe(client, message)
	case "unsubscribe":
		g.handleUnsubscribe(client, message)
	case "ping":
		g.sendToClient(client, WSResponse{
			Type:    "pong",
			Channel: ChannelControl,
		})
	default:
		logger.Warn().Str("type", message.Type).Str("client_id", client.ID).Msg("Unknown message type")
	}
}

func (g *Gateway) handleSubscribe(client *Client, msg WSMessage) {
	if msg.Symbol == "" {
		g.sendToClient(client, WSResponse{
			Type:    "error",
			Channel: ChannelControl,
			Data:    map[string]string{"error": "Symbol required for subscription"},
		})
		return
	}

	g.mu.Lock()
	g.subscriptions[client.ID][msg.Symbol] = true
	g.mu.Unlock()

	client.mu.Lock()
	client.Channels[msg.Symbol] = true
	client.mu.Unlock()

	logger.Info().Str("client_id", client.ID).Str("symbol", msg.Symbol).Msg("Client subscribed to symbol")

	g.sendToClient(client, WSResponse{
		Type:    "subscribed",
		Channel: ChannelMarket,
		Symbol:  msg.Symbol,
		Data:    map[string]string{"status": "subscribed"},
	})
}

func (g *Gateway) handleUnsubscribe(client *Client, msg WSMessage) {
	if msg.Symbol == "" {
		return
	}

	g.mu.Lock()
	delete(g.subscriptions[client.ID], msg.Symbol)
	g.mu.Unlock()

	client.mu.Lock()
	delete(client.Channels, msg.Symbol)
	client.mu.Unlock()

	logger.Info().Str("client_id", client.ID).Str("symbol", msg.Symbol).Msg("Client unsubscribed from symbol")

	g.sendToClient(client, WSResponse{
		Type:    "unsubscribed",
		Channel: ChannelMarket,
		Symbol:  msg.Symbol,
		Data:    map[string]string{"status": "unsubscribed"},
	})
}

func (g *Gateway) forwardMarketEvents(client *Client) {
	eventChan, unsubscribe := g.marketService.SubscribeAll()
	defer unsubscribe()

	for {
		select {
		case event, ok := <-eventChan:
			if !ok {
				logger.Info().Str("client_id", client.ID).Msg("Event channel closed")
				return
			}

			// Check if client is subscribed to this symbol
			client.mu.RLock()
			subscribed := client.Channels[event.Symbol]
			client.mu.RUnlock()

			if subscribed {
				g.sendToClient(client, WSResponse{
					Type:    string(event.Type),
					Channel: ChannelMarket,
					Symbol:  event.Symbol,
					Data:    event.Data,
				})
			}
		case <-g.ctx.Done():
			return
		}
	}
}

func (g *Gateway) sendToClient(client *Client, resp WSResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		logger.Error().Err(err).Str("client_id", client.ID).Msg("Failed to marshal response")
		return
	}

	if err := client.Conn.WriteMessage(ws.TextMessage, data); err != nil {
		logger.Error().Err(err).Str("client_id", client.ID).Msg("Failed to write message")
	}
}

func (g *Gateway) disconnectClient(clientID string) {
	g.mu.Lock()
	delete(g.clients, clientID)
	delete(g.subscriptions, clientID)
	g.mu.Unlock()

	logger.Info().Str("client_id", clientID).Msg("Client disconnected")
}

// Broadcast sends a message to all connected clients
func (g *Gateway) Broadcast(resp WSResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		logger.Error().Err(err).Msg("Failed to marshal broadcast message")
		return
	}

	g.mu.RLock()
	defer g.mu.RUnlock()

	for _, client := range g.clients {
		if err := client.Conn.WriteMessage(ws.TextMessage, data); err != nil {
			logger.Error().Err(err).Str("client_id", client.ID).Msg("Failed to broadcast to client")
		}
	}
}

// ClientCount returns the number of connected clients
func (g *Gateway) ClientCount() int {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return len(g.clients)
}

// Close shuts down the gateway
func (g *Gateway) Close() error {
	g.cancel()
	return nil
}
