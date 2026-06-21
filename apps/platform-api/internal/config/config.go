package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Valkey   ValkeyConfig
	Logging  LoggingConfig
}

type ServerConfig struct {
	Host string
	Port int
}

type DatabaseConfig struct {
	URL string
}

type ValkeyConfig struct {
	URL          string
	PoolSize     int
	MinIdleConns int
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type LoggingConfig struct {
	Level  string
	Format string
}

func Load() (*Config, error) {
	return &Config{
		Server: ServerConfig{
			Host: getEnv("API_HOST", "0.0.0.0"),
			Port: getEnvInt("API_PORT", 8080),
		},
		Database: DatabaseConfig{
			URL: getEnv("POSTGRES_URL", "postgresql://charting_user:charting_dev_password@localhost:5432/charting_platform"),
		},
		Valkey: ValkeyConfig{
			URL:          getEnv("VALKEY_URL", "redis://localhost:6379"),
			PoolSize:     getEnvInt("VALKEY_POOL_SIZE", 10),
			MinIdleConns: getEnvInt("VALKEY_MIN_IDLE_CONNS", 5),
			DialTimeout:  getEnvDuration("VALKEY_DIAL_TIMEOUT", 5*time.Second),
			ReadTimeout:  getEnvDuration("VALKEY_READ_TIMEOUT", 3*time.Second),
			WriteTimeout: getEnvDuration("VALKEY_WRITE_TIMEOUT", 3*time.Second),
		},
		Logging: LoggingConfig{
			Level:  getEnv("API_LOG_LEVEL", "info"),
			Format: getEnv("API_LOG_FORMAT", "json"),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
