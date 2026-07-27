package main

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/twinkle"
)

// The SMALL reset boundary reads the user's own calendar day ([G2][U7]), so the API binary must be
// able to load a real IANA zone. Two halves, because neither alone is sufficient: resolution must
// work, AND it must not depend on the operating system — the image is gcr.io/distroless/static-
// debian12, which ships no /usr/share/zoneinfo. A CI/dev machine HAS the system database, so a
// runtime check would pass even with the embed deleted; the import assertion is what actually
// guards the deployed image. A regression here degrades every user to UTC silently, never loudly.
func TestProductionAPIResolvesIANAZones(t *testing.T) {
	for _, name := range []string{"Asia/Seoul", "America/New_York", "Pacific/Kiritimati"} {
		if location := twinkle.LocationOf(name); location == time.UTC {
			t.Fatalf("LocationOf(%q) fell back to UTC — the zone database is unreachable", name)
		}
	}

	source, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read cmd/api/main.go: %v", err)
	}
	if !strings.Contains(string(source), `_ "time/tzdata"`) {
		t.Fatal(`cmd/api no longer embeds the zone database: restore _ "time/tzdata" in main.go, or the distroless image resolves every zone to UTC`)
	}
}
