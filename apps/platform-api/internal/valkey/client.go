package valkey

import (
	"context"
	"fmt"
	"time"

	"github.com/charting-platform/platform-api/internal/config"
	"github.com/charting-platform/platform-api/pkg/logger"
	"github.com/valkey-io/valkey-go"
)

type Client struct {
	client valkey.Client
}

type MarketEventHandler func(channel string, message []byte)

func NewClient(cfg config.ValkeyConfig) (*Client, error) {
	logger.Info().Str("url", cfg.URL).Msg("Connecting to Valkey")

	client, err := valkey.NewClient(valkey.ClientOption{
		InitAddress:  []string{cfg.URL},
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
		Dialer: func(ctx context.Context) (valkey.Conn, error) {
			return valkey.Dial(ctx, valkey.DialOption{
				DialTimeout:  cfg.DialTimeout,
				ReadTimeout:  cfg.ReadTimeout,
				WriteTimeout: cfg.WriteTimeout,
			})
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create valkey client: %w", err)
	}

	return &Client{client: client}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.client.Set(ctx, key, value, expiration).Err()
}

func (c *Client) Get(ctx context.Context, key string) (string, error) {
	return c.client.Get(ctx, key).Text()
}

func (c *Client) Subscribe(ctx context.Context, channels []string, handler MarketEventHandler) error {
	pubsub := c.client.Subscribe(ctx, channels...)

	ch := pubsub.Channel()
	go func() {
		for msg := range ch {
			handler(msg.Channel, []byte(msg.Payload))
		}
	}()

	return nil
}

func (c *Client) PSubscribe(ctx context.Context, patterns []string, handler MarketEventHandler) error {
	pubsub := c.client.PSubscribe(ctx, patterns...)

	ch := pubsub.Channel()
	go func() {
		for msg := range ch {
			handler(msg.Channel, []byte(msg.Payload))
		}
	}()

	return nil
}

func (c *Client) Publish(ctx context.Context, channel string, message interface{}) error {
	data, err := serializeMessage(message)
	if err != nil {
		return err
	}
	return c.client.Publish(ctx, channel, data).Err()
}

func (c *Client) Close() error {
	return c.client.Close()
}

func (c *Client) HealthCheck(ctx context.Context) error {
	return c.Ping(ctx)
}

func serializeMessage(msg interface{}) ([]byte, error) {
	switch v := msg.(type) {
	case []byte:
		return v, nil
	case string:
		return []byte(v), nil
	default:
		// For complex types, we'd use JSON but keeping simple for now
		return []byte(fmt.Sprintf("%v", v)), nil
	}
}
