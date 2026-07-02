package ai

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

const aiAdapterCacheMaxEntries = 1024

func stableHash(parts ...any) string {
	hash := sha256.New()
	for _, part := range parts {
		raw, _ := json.Marshal(part)
		hash.Write(raw)
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil))
}

type boundedCache[V any] struct {
	max     int
	entries map[string]V
	order   []string
}

func newBoundedCache[V any](max int) boundedCache[V] {
	if max <= 0 {
		max = aiAdapterCacheMaxEntries
	}
	return boundedCache[V]{
		max:     max,
		entries: make(map[string]V),
		order:   make([]string, 0, max),
	}
}

func (c *boundedCache[V]) get(key string) (V, bool) {
	value, ok := c.entries[key]
	return value, ok
}

func (c *boundedCache[V]) put(key string, value V) {
	if _, ok := c.entries[key]; ok {
		c.entries[key] = value
		return
	}
	c.entries[key] = value
	c.order = append(c.order, key)
	for len(c.entries) > c.max && len(c.order) > 0 {
		oldest := c.order[0]
		c.order = c.order[1:]
		delete(c.entries, oldest)
	}
}
