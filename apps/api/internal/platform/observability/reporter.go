package observability

import (
	"context"
	"sync"
	"time"
)

type Level string

const (
	LevelInfo    Level = "info"
	LevelWarning Level = "warning"
	LevelError   Level = "error"
	LevelFatal   Level = "fatal"
)

type Reporter interface {
	CaptureException(ctx context.Context, err error, attrs Attributes)
	CaptureMessage(ctx context.Context, message string, level Level, attrs Attributes)
	Flush(timeout time.Duration) bool
}

type NoopReporter struct{}

func (NoopReporter) CaptureException(context.Context, error, Attributes)       {}
func (NoopReporter) CaptureMessage(context.Context, string, Level, Attributes) {}
func (NoopReporter) Flush(time.Duration) bool                                  { return true }

type Event struct {
	Kind       string
	Error      string
	Message    string
	Level      Level
	Attributes map[string]string
}

type InMemoryReporter struct {
	mu     sync.Mutex
	events []Event
}

func NewInMemoryReporter() *InMemoryReporter {
	return &InMemoryReporter{}
}

func (r *InMemoryReporter) CaptureException(_ context.Context, err error, attrs Attributes) {
	r.mu.Lock()
	defer r.mu.Unlock()
	message := ""
	if err != nil {
		message = err.Error()
	}
	r.events = append(r.events, Event{
		Kind:       "exception",
		Error:      message,
		Attributes: attrs.Values(),
	})
}

func (r *InMemoryReporter) CaptureMessage(_ context.Context, message string, level Level, attrs Attributes) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, Event{
		Kind:       "message",
		Message:    message,
		Level:      level,
		Attributes: attrs.Values(),
	})
}

func (r *InMemoryReporter) Flush(time.Duration) bool {
	return true
}

func (r *InMemoryReporter) Events() []Event {
	r.mu.Lock()
	defer r.mu.Unlock()
	events := make([]Event, len(r.events))
	copy(events, r.events)
	return events
}
