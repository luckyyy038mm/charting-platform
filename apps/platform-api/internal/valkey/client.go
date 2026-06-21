package valkey

import (
	"context"
	"fmt"
	"time"

	"github.com/charting-platform/platform-api/internal/config"
	"github.com/charting-platform/platform-api/pkg/logger"
	"github.com/redis/go-redis/v9"
)

type Client struct {
	client *redis.Client
}

type MarketEventHandler func(channel string, message []byte)

func NewClient(cfg config.ValkeyConfig) (*Client, error) {
	logger.Info().Str("addr", cfg.URL).Msg("Connecting to Valkey/Redis")

	opts, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse valkey url: %w", err)
	}

	client := redis.NewClient(&redis.Options{
		Addr:         opts.Addr,
		Password:     opts.Password,
		DB:           opts.DB,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
		DialTimeout:  cfg.DialTimeout,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	})

	return &Client{client: client}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.client.Set(ctx, key, value, expiration).Err()
}

func (c *Client) Get(ctx context.Context, key string) (string, error) {
	val, err := c.client.Get(ctx, key).Result()
	return val, err
}

func (c *Client) Subscribe(ctx context.Context, channels []string, handler MarketEventHandler) error {
	pubsub := c.client.Subscribe(ctx, channels...)

	go func() {
		for msg := range pubsub.Channel() {
			handler(msg.Channel, []byte(msg.Payload))
		}
	}()

	return nil
}

func (c *Client) PSubscribe(ctx context.Context, patterns []string, handler MarketEventHandler) error {
	pubsub := c.client.PSubscribe(ctx, patterns...)

	go func() {
		for msg := range pubsub.Channel() {
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
		return []byte(fmt.Sprintf("%v", v)), nil
	}
}
