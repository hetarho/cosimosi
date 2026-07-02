package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

var ErrUserScopeRequired = errors.New("ai adapter requires authenticated user scope")

type CostLimitError struct {
	UserID      string
	Limit       int
	WindowStart time.Time
}

func (e *CostLimitError) Error() string {
	return fmt.Sprintf("ai daily call cap exceeded for user %s: limit %d", e.UserID, e.Limit)
}

func (e *CostLimitError) RetryAt() time.Time {
	return e.WindowStart.Add(24 * time.Hour)
}

func IsCostLimitError(err error) bool {
	var target *CostLimitError
	return errors.As(err, &target)
}

type Meter struct {
	mu       sync.Mutex
	dailyCap int
	now      func() time.Time
	calls    map[string]int
}

func NewMeter() *Meter {
	return newMeter(values.AiDailyCallCap, nil)
}

func newMeter(dailyCap int, now func() time.Time) *Meter {
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	return &Meter{
		dailyCap: dailyCap,
		now:      now,
		calls:    make(map[string]int),
	}
}

func (m *Meter) UserID(ctx context.Context) (string, error) {
	userID, ok := platform.UserIDFromContext(ctx)
	if !ok {
		return "", ErrUserScopeRequired
	}
	return userID, nil
}

func (m *Meter) Charge(ctx context.Context) (string, error) {
	userID, err := m.UserID(ctx)
	if err != nil {
		return "", err
	}
	now := m.now().UTC()
	windowStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	currentWindow := windowStart.Format(time.DateOnly)
	key := userID + "|" + currentWindow

	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneLocked(currentWindow)
	if m.calls[key] >= m.dailyCap {
		return "", &CostLimitError{
			UserID:      userID,
			Limit:       m.dailyCap,
			WindowStart: windowStart,
		}
	}
	m.calls[key]++
	return userID, nil
}

func (m *Meter) pruneLocked(currentWindow string) {
	suffix := "|" + currentWindow
	for key := range m.calls {
		if !strings.HasSuffix(key, suffix) {
			delete(m.calls, key)
		}
	}
}
