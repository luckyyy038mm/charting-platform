package market

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/charting-platform/platform-api/internal/valkey"
	"github.com/charting-platform/platform-api/pkg/logger"
)

// MarketEventType represents the type of market event
type MarketEventType string

const (
	EventTypeTrade        MarketEventType = "trade"
	EventTypeKline        MarketEventType = "kline"
	EventTypeDepth        MarketEventType = "depth"
	EventTypeDepthUpdate  MarketEventType = "depth_update"
	EventTypeTicker       MarketEventType = "ticker"
	EventTypeMarketStatus MarketEventType = "market_status"
)

// MarketEvent represents a normalized market event from Valkey pub/sub
type MarketEvent struct {
	Type      MarketEventType `json:"type"`
	Symbol    string          `json:"symbol"`
	Timestamp int64           `json:"timestamp"`
	Data      json.RawMessage `json:"data"`
}

// TradeData represents trade event data
type TradeData struct {
	TradeID      string  `json:"trade_id"`
	Price       float64 `json:"price"`
	Quantity    float64 `json:"quantity"`
	QuoteVolume float64 `json:"quote_volume"`
	IsBuyerMaker bool   `json:"is_buyer_maker"`
	Time        int64   `json:"time"`
}

// KlineData represents kline/candlestick event data
type KlineData struct {
	Symbol       string  `json:"symbol"`
	Timeframe    string  `json:"timeframe"`
	Open         float64 `json:"open"`
	High         float64 `json:"high"`
	Low          float64 `json:"low"`
	Close        float64 `json:"close"`
	Volume       float64 `json:"volume"`
	QuoteVolume  float64 `json:"quote_volume"`
	TradesCount int64   `json:"trades_count"`
	OpenTime     int64   `json:"open_time"`
	CloseTime    int64   `json:"close_time"`
	IsClosed     bool    `json:"is_closed"`
}

// DepthData represents order book depth data
type DepthData struct {
	Symbol       string    `json:"symbol"`
	Bids         [][]float64 `json:"bids"` // [price, quantity]
	Asks         [][]float64 `json:"asks"`
	LastUpdateID int64     `json:"last_update_id"`
	Timestamp    int64     `json:"timestamp"`
}

// MarketService handles market data subscriptions and routing
type MarketService struct {
	valkey       *valkey.Client
	subscribers  map[string]map[chan MarketEvent]bool
	mu           sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
}

func NewMarketService(vc *valkey.Client) *MarketService {
	ctx, cancel := context.WithCancel(context.Background())
	return &MarketService{
		valkey:      vc,
		subscribers: make(map[string]map[chan MarketEvent]bool),
		ctx:         ctx,
		cancel:      cancel,
	}
}

// SubscribeSymbol subscribes to market events for a specific symbol
func (s *MarketService) SubscribeSymbol(symbol string) (<-chan MarketEvent, func()) {
	eventChan := make(chan MarketEvent, 100)

	s.mu.Lock()
	if s.subscribers[symbol] == nil {
		s.subscribers[symbol] = make(map[chan MarketEvent]bool)
	}
	s.subscribers[symbol][eventChan] = true
	s.mu.Unlock()

	// Create Valkey subscription if this is the first subscriber for this symbol
	s.ensureSymbolSubscription(symbol)

	// Return unsubscribe function
	unsubscribe := func() {
		s.mu.Lock()
		delete(s.subscribers[symbol], eventChan)
		s.mu.Unlock()
		close(eventChan)
	}

	return eventChan, unsubscribe
}

func (s *MarketService) ensureSymbolSubscription(symbol string) {
	channel := fmt.Sprintf("market:%s", symbol)
	
	err := s.valkey.Subscribe(s.ctx, []string{channel}, func(ch string, msg []byte) {
		var event MarketEvent
		if err := json.Unmarshal(msg, &event); err != nil {
			logger.Error().Err(err).Str("channel", ch).Msg("Failed to parse market event")
			return
		}

		// Route event to all subscribers for this symbol
		s.mu.RLock()
		defer s.mu.RUnlock()

		if subs, ok := s.subscribers[symbol]; ok {
			for ch := range subs {
				select {
				case ch <- event:
				default:
					logger.Warn().Str("symbol", symbol).Msg("Event channel full, dropping event")
				}
			}
		}
	})

	if err != nil {
		logger.Error().Err(err).Str("symbol", symbol).Msg("Failed to subscribe to symbol channel")
	}
}

// SubscribeAll subscribes to all market events (wildcard subscription)
func (s *MarketService) SubscribeAll() (<-chan MarketEvent, func()) {
	eventChan := make(chan MarketEvent, 100)

	s.mu.Lock()
	s.subscribers["*"] = map[chan MarketEvent]bool{eventChan: true}
	s.mu.Unlock()

	// Subscribe to all market events using pattern
	err := s.valkey.PSubscribe(s.ctx, []string{"market:*"}, func(ch string, msg []byte) {
		var event MarketEvent
		if err := json.Unmarshal(msg, &event); err != nil {
			logger.Error().Err(err).Str("channel", ch).Msg("Failed to parse market event")
			return
		}

		s.mu.RLock()
		defer s.mu.RUnlock()

		// Route to wildcard subscribers
		if subs, ok := s.subscribers["*"]; ok {
			for subCh := range subs {
				select {
				case subCh <- event:
				default:
					logger.Warn().Msg("Event channel full, dropping event")
				}
			}
		}
	})

	if err != nil {
		logger.Error().Err(err).Msg("Failed to subscribe to market:* pattern")
	}

	unsubscribe := func() {
		s.mu.Lock()
		delete(s.subscribers["*"], eventChan)
		s.mu.Unlock()
		close(eventChan)
	}

	return eventChan, unsubscribe
}

// GetSymbolSnapshot retrieves the latest snapshot for a symbol from Valkey
func (s *MarketService) GetSymbolSnapshot(ctx context.Context, symbol string) (map[string]interface{}, error) {
	key := fmt.Sprintf("snapshot:%s", symbol)
	
	data, err := s.valkey.Get(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	var snapshot map[string]interface{}
	if err := json.Unmarshal([]byte(data), &snapshot); err != nil {
		return nil, fmt.Errorf("failed to parse snapshot: %w", err)
	}

	return snapshot, nil
}

// Close shuts down the market service
func (s *MarketService) Close() error {
	s.cancel()
	return nil
}
