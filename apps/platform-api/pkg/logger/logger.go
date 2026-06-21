package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
)

var log zerolog.Logger

func Init(level string) {
	zerolog.TimeFieldFormat = time.RFC3339
	zerolog.TimestampFieldName = "timestamp"

	log = zerolog.New(os.Stdout).
		With().
		Timestamp().
		Str("service", "platform-api").
		Logger()

	if level == "debug" {
		log = log.Level(zerolog.DebugLevel)
	} else if level == "info" {
		log = log.Level(zerolog.InfoLevel)
	} else if level == "warn" {
		log = log.Level(zerolog.WarnLevel)
	} else {
		log = log.Level(zerolog.ErrorLevel)
	}
}

func Get() *zerolog.Logger {
	return &log
}

func Info() *zerolog.Event {
	return log.Info()
}

func Debug() *zerolog.Event {
	return log.Debug()
}

func Warn() *zerolog.Event {
	return log.Warn()
}

func Error() *zerolog.Event {
	return log.Error()
}

func Fatal() *zerolog.Event {
	return log.Fatal()
}
