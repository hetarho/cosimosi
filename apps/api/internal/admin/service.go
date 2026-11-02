package admin

import (
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// Service is the admin console's use-case layer: the authorization rule plus admin-management,
// user-list, stardust-grant, AI-config, and dashboard behaviors. All policy lives here (§2.9#7);
// the handler is a thin proto↔domain map. Cross-context work goes strictly through the ports.
type Service struct {
	store      Store
	directory  AccountDirectory
	stardust   TwinkleGranter
	memStats   MemoryStats
	usage      AIUsageReader
	jobs       JobHealthReader
	cipher     Cipher
	catalog    ProviderCatalog
	models     ModelCatalog
	envConfig  AIEnvConfig
	seedIDs    map[string]struct{}
	seedEmails map[string]struct{}
	devMode    bool
	now        func() time.Time
	newID      func() string
}

// ServiceDeps carries the concrete adapters injected at the composition root. SeedAdmins is the
// raw ADMIN_USER_IDS env value (comma-separated Supabase ids and/or verified emails).
type ServiceDeps struct {
	Store      Store
	Directory  AccountDirectory
	Twinkle    TwinkleGranter
	MemStats   MemoryStats
	Usage      AIUsageReader
	Jobs       JobHealthReader
	Cipher     Cipher
	Catalog    ProviderCatalog
	Models     ModelCatalog
	EnvConfig  AIEnvConfig
	SeedAdmins string
	// DevMode makes every authenticated caller an admin — set ONLY from the dev-auth bypass
	// (COSIMOSI_DEV_AUTH), never in production, so `pnpm dev` reaches /admin without seeding ids.
	DevMode bool
	// Now/NewID are test seams; nil selects the real UTC clock and the platform id.
	Now   func() time.Time
	NewID func() string
}

func NewService(deps ServiceDeps) (*Service, error) {
	switch {
	case deps.Store == nil:
		return nil, ErrStoreRequired
	case deps.Directory == nil:
		return nil, ErrDirectoryRequired
	case deps.Twinkle == nil:
		return nil, ErrStardustRequired
	case deps.MemStats == nil:
		return nil, ErrMemoryStats
	case deps.Usage == nil:
		return nil, ErrUsageRequired
	case deps.Jobs == nil:
		return nil, ErrJobsRequired
	case deps.Cipher == nil:
		return nil, ErrCipherRequired
	case deps.Catalog == nil:
		return nil, ErrCatalogRequired
	case deps.Models == nil:
		return nil, ErrModelsRequired
	case deps.EnvConfig == nil:
		return nil, ErrEnvConfigRequired
	}
	ids, emails := parseSeedAdmins(deps.SeedAdmins)
	svc := &Service{
		store:      deps.Store,
		directory:  deps.Directory,
		stardust:   deps.Twinkle,
		memStats:   deps.MemStats,
		usage:      deps.Usage,
		jobs:       deps.Jobs,
		cipher:     deps.Cipher,
		catalog:    deps.Catalog,
		models:     deps.Models,
		envConfig:  deps.EnvConfig,
		seedIDs:    ids,
		seedEmails: emails,
		devMode:    deps.DevMode,
		now:        deps.Now,
		newID:      deps.NewID,
	}
	if svc.now == nil {
		svc.now = func() time.Time { return time.Now().UTC() }
	}
	if svc.newID == nil {
		svc.newID = platform.NewID
	}
	return svc, nil
}

// parseSeedAdmins splits ADMIN_USER_IDS into an id set and an email set (an entry with '@' is an
// email; emails compare case-insensitively). Both are the undemotable trust anchor.
func parseSeedAdmins(raw string) (ids map[string]struct{}, emails map[string]struct{}) {
	ids = map[string]struct{}{}
	emails = map[string]struct{}{}
	for _, part := range strings.Split(raw, ",") {
		entry := strings.TrimSpace(part)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "@") {
			emails[strings.ToLower(entry)] = struct{}{}
			continue
		}
		ids[entry] = struct{}{}
	}
	return ids, emails
}

func (s *Service) auditEntry(actor string, action string, target string, detail map[string]string) AuditEntry {
	return AuditEntry{
		ID:     s.newID(),
		Actor:  actor,
		Action: action,
		Target: target,
		Detail: detail,
	}
}
