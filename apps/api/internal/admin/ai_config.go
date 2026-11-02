package admin

import (
	"context"
	"strings"
)

// ListProviderKeys returns every provider slot with its key status + capability support, so the
// console can manage keys per provider. The plaintext key is never returned — only KeySet + hint.
func (s *Service) ListProviderKeys(ctx context.Context) ([]ProviderKeyInfo, error) {
	stored, err := s.store.ListProviderKeys(ctx)
	if err != nil {
		return nil, err
	}
	byProvider := make(map[string]StoredProviderKey, len(stored))
	for _, k := range stored {
		byProvider[k.Provider] = k
	}
	slots := s.catalog.Slots()
	out := make([]ProviderKeyInfo, 0, len(slots))
	for _, provider := range slots {
		info := ProviderKeyInfo{
			Provider:             provider,
			SupportsLLM:          s.catalog.SupportsLLM(provider),
			SupportsEmbedding:    s.catalog.SupportsEmbedding(provider),
			ImplementedLLM:       s.catalog.ImplementedLLM(provider),
			ImplementedEmbedding: s.catalog.ImplementedEmbedding(provider),
		}
		if key, ok := byProvider[provider]; ok {
			info.KeySet = true
			info.KeyHint = key.KeyHint
			info.UpdatedBy = key.UpdatedBy
			info.UpdatedAt = key.UpdatedAt
		}
		out = append(out, info)
	}
	return out, nil
}

// SetProviderKey stores one provider's API key, encrypted at rest. Rejects an unknown provider
// slot.
func (s *Service) SetProviderKey(ctx context.Context, actor string, provider string, apiKey string) (ProviderKeyInfo, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	apiKey = strings.TrimSpace(apiKey)
	if provider == "" {
		return ProviderKeyInfo{}, ErrProviderRequired
	}
	if !s.knownProvider(provider) {
		return ProviderKeyInfo{}, ErrUnknownProvider
	}
	if apiKey == "" {
		return ProviderKeyInfo{}, ErrProviderKeyRequired
	}
	encrypted, err := s.cipher.Encrypt([]byte(apiKey))
	if err != nil {
		return ProviderKeyInfo{}, err
	}
	key := StoredProviderKey{
		Provider:        provider,
		APIKeyEncrypted: encrypted,
		KeyHint:         s.cipher.Hint(apiKey),
		UpdatedBy:       actor,
		UpdatedAt:       s.now(),
	}
	audit := s.auditEntry(actor, ActionSetProviderKey, provider, nil)
	if err := s.store.UpsertProviderKey(ctx, key, audit); err != nil {
		return ProviderKeyInfo{}, err
	}
	return ProviderKeyInfo{
		Provider:             provider,
		KeySet:               true,
		KeyHint:              key.KeyHint,
		SupportsLLM:          s.catalog.SupportsLLM(provider),
		SupportsEmbedding:    s.catalog.SupportsEmbedding(provider),
		ImplementedLLM:       s.catalog.ImplementedLLM(provider),
		ImplementedEmbedding: s.catalog.ImplementedEmbedding(provider),
		UpdatedBy:            actor,
		UpdatedAt:            key.UpdatedAt,
	}, nil
}

// ClearProviderKey removes a provider's stored key.
func (s *Service) ClearProviderKey(ctx context.Context, actor string, provider string) (ProviderKeyInfo, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		return ProviderKeyInfo{}, ErrProviderRequired
	}
	if !s.knownProvider(provider) {
		return ProviderKeyInfo{}, ErrUnknownProvider
	}
	audit := s.auditEntry(actor, ActionClearProviderKey, provider, nil)
	if _, err := s.store.DeleteProviderKey(ctx, provider, audit); err != nil {
		return ProviderKeyInfo{}, err
	}
	return ProviderKeyInfo{
		Provider:             provider,
		KeySet:               false,
		SupportsLLM:          s.catalog.SupportsLLM(provider),
		SupportsEmbedding:    s.catalog.SupportsEmbedding(provider),
		ImplementedLLM:       s.catalog.ImplementedLLM(provider),
		ImplementedEmbedding: s.catalog.ImplementedEmbedding(provider),
	}, nil
}

// GetAIConfig returns the selected provider+model per capability. A stored DB row wins (source
// "db"); otherwise the env selection is reported (source "env" when a provider is configured, else
// "unset").
func (s *Service) GetAIConfig(ctx context.Context) ([]CapabilitySelection, error) {
	capabilities := []AICapability{CapabilityLLM, CapabilityEmbedding}
	out := make([]CapabilitySelection, 0, len(capabilities))
	for _, capability := range capabilities {
		stored, err := s.store.GetCapabilityConfig(ctx, capability)
		if err != nil {
			return nil, err
		}
		if stored != nil {
			out = append(out, CapabilitySelection{
				Capability: capability,
				Provider:   stored.Provider,
				Model:      stored.Model,
				Source:     "db",
				UpdatedBy:  stored.UpdatedBy,
				UpdatedAt:  stored.UpdatedAt,
			})
			continue
		}
		provider, model, keySet := s.envSnapshot(capability)
		source := "unset"
		if provider != "" || keySet {
			source = "env"
		}
		out = append(out, CapabilitySelection{
			Capability: capability,
			Provider:   provider,
			Model:      model,
			Source:     source,
		})
	}
	return out, nil
}

func (s *Service) envSnapshot(capability AICapability) (provider, model string, keySet bool) {
	return s.envConfig.EnvConfig(capability)
}

// SetAIConfig selects a capability's provider + model. The provider must support the capability, be
// implemented (a concrete adapter exists), and have a stored key — the console never selects a
// provider the factory would then fail to build. No key here; keys are managed per provider.
// Applied without redeploy — the factory's config source rebuilds on the next call.
func (s *Service) SetAIConfig(ctx context.Context, actor string, capability AICapability, provider string, model string) (CapabilitySelection, error) {
	if !KnownCapability(capability) {
		return CapabilitySelection{}, ErrUnknownCapability
	}
	provider = strings.ToLower(strings.TrimSpace(provider))
	model = strings.TrimSpace(model)
	if provider == "" {
		return CapabilitySelection{}, ErrProviderRequired
	}
	if !s.knownProvider(provider) {
		return CapabilitySelection{}, ErrUnknownProvider
	}
	supports, implemented := s.capabilitySupport(capability, provider)
	if !supports {
		return CapabilitySelection{}, ErrProviderCapabilityMismatch
	}
	if !implemented {
		return CapabilitySelection{}, ErrProviderNotImplemented
	}
	key, err := s.store.GetProviderKey(ctx, provider)
	if err != nil {
		return CapabilitySelection{}, err
	}
	if key == nil {
		return CapabilitySelection{}, ErrProviderKeyMissing
	}
	cfg := StoredCapabilityConfig{
		Capability: capability,
		Provider:   provider,
		Model:      model,
		UpdatedBy:  actor,
		UpdatedAt:  s.now(),
	}
	audit := s.auditEntry(actor, ActionSetAIConfig, string(capability), map[string]string{
		"provider": provider,
		"model":    model,
	})
	if err := s.store.UpsertCapabilityConfig(ctx, cfg, audit); err != nil {
		return CapabilitySelection{}, err
	}
	return CapabilitySelection{
		Capability: capability,
		Provider:   cfg.Provider,
		Model:      cfg.Model,
		Source:     "db",
		UpdatedBy:  cfg.UpdatedBy,
		UpdatedAt:  cfg.UpdatedAt,
	}, nil
}

// ListProviderModels returns the model ids a provider currently serves for one capability — the
// advisory feed behind the console's model dropdown. The same eligibility chain as SetAIConfig
// gates it (known slot → capability support → implemented → stored key), so the console never
// queries a vendor it could not select; the fetch itself goes through the ModelCatalog port and
// the stored key never enters this context. SetAIConfig stays advisory-free: nothing here
// validates a selection against the returned list.
func (s *Service) ListProviderModels(ctx context.Context, capability AICapability, provider string) ([]ProviderModel, error) {
	if !KnownCapability(capability) {
		return nil, ErrUnknownCapability
	}
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		return nil, ErrProviderRequired
	}
	if !s.knownProvider(provider) {
		return nil, ErrUnknownProvider
	}
	supports, implemented := s.capabilitySupport(capability, provider)
	if !supports {
		return nil, ErrProviderCapabilityMismatch
	}
	if !implemented {
		return nil, ErrProviderNotImplemented
	}
	key, err := s.store.GetProviderKey(ctx, provider)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, ErrProviderKeyMissing
	}
	return s.models.ListModels(ctx, capability, provider)
}

func (s *Service) knownProvider(provider string) bool {
	for _, slot := range s.catalog.Slots() {
		if slot == provider {
			return true
		}
	}
	return false
}

func (s *Service) capabilitySupport(capability AICapability, provider string) (supports bool, implemented bool) {
	switch capability {
	case CapabilityLLM:
		return s.catalog.SupportsLLM(provider), s.catalog.ImplementedLLM(provider)
	case CapabilityEmbedding:
		return s.catalog.SupportsEmbedding(provider), s.catalog.ImplementedEmbedding(provider)
	default:
		return false, false
	}
}

// GetAIUsage returns the metering snapshot for the usage dashboard.
func (s *Service) GetAIUsage(ctx context.Context) (AIUsage, error) {
	return s.usage.Usage(ctx)
}

// GetJobHealth returns the background-job queue aggregate.
func (s *Service) GetJobHealth(ctx context.Context) (JobHealth, error) {
	return s.jobs.Health(ctx)
}
