package rpc

import (
	"context"
	"errors"
	"strings"
	"testing"

	"connectrpc.com/connect"
	storev1 "github.com/cosimosi/api/internal/gen/cosimosi/store/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/store"
	"github.com/cosimosi/api/internal/store/pg"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	repo := pg.NewStore(nil)
	service, err := store.NewService(store.ServiceDeps{
		Ownerships:   repo,
		Selections:   repo,
		Purge:        repo,
		Achievements: store.NoAchievementRecorder{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	server, err := NewServer(service)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	return server
}

func TestNewServerRefusesAMissingService(t *testing.T) {
	t.Parallel()
	if _, err := NewServer(nil); !errors.Is(err, ErrServiceRequired) {
		t.Fatalf("NewServer(nil) err = %v, want ErrServiceRequired", err)
	}
}

func TestBothReadsRefuseAnUnauthenticatedRequest(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)
	ctx := context.Background()
	if _, err := server.GetCatalog(ctx, connect.NewRequest(&storev1.GetCatalogRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("GetCatalog code = %s, want unauthenticated", connect.CodeOf(err))
	}
	err := domainError(store.ErrScopeRequired)
	info, ok := apperr.Info(err)
	if connect.CodeOf(err) != connect.CodeUnauthenticated || !ok || info.GetReason() != reasonScopeRequired {
		t.Errorf("domainError(ErrScopeRequired) = code %s info %#v", connect.CodeOf(err), info)
	}
	if code := connect.CodeOf(domainError(errors.New("database exploded"))); code != connect.CodeInternal {
		t.Errorf("unknown error code = %s, want internal", code)
	}
}

// Walked over the DECLARED set, never a hand-listed pair. An unmapped kind leaves as UNSPECIFIED,
// which proto3 JSON omits and every client drops rather than guesses — so the rows of a whole kind
// disappear from the panel with no error on either side. The `default` arm in protoKind cannot tell
// a forgotten case from a genuinely unknown value; this loop can.
func TestEveryDomainKindAndAcquisitionHasAWireValue(t *testing.T) {
	t.Parallel()
	seen := map[storev1.OrnamentKind]store.OrnamentKind{}
	for _, kind := range store.AllOrnamentKinds() {
		wire := protoKind(kind)
		if wire == storev1.OrnamentKind_ORNAMENT_KIND_UNSPECIFIED {
			t.Errorf("kind %q has no wire value", kind)
			continue
		}
		// Two kinds sharing a wire value would answer one kind's rows under the other's heading.
		if other, dup := seen[wire]; dup {
			t.Errorf("kinds %q and %q share the wire value %v", other, kind, wire)
		}
		seen[wire] = kind
	}
	for _, acquisition := range []store.OrnamentAcquisition{
		store.AcquisitionFree,
		store.AcquisitionPurchase,
		store.AcquisitionAchievement,
	} {
		if protoAcquisition(acquisition) == storev1.OrnamentAcquisition_ORNAMENT_ACQUISITION_UNSPECIFIED {
			t.Errorf("acquisition %q has no wire value", acquisition)
		}
	}
	// An unnameable value maps to UNSPECIFIED rather than to some neighbouring kind.
	if protoKind("PALETTE") != storev1.OrnamentKind_ORNAMENT_KIND_UNSPECIFIED {
		t.Error("a kind outside the closed set was given a wire value")
	}
}

// The wire's shape IS the [P7]/[V10] guard: what it cannot say, no client can render. Asserted on the
// descriptors so adding a field to the proto fails here rather than in review.
func TestTheWireCannotNameAUserAnAchievementOrAnyVisualParameter(t *testing.T) {
	t.Parallel()
	ornamentFields := (&storev1.Ornament{}).ProtoReflect().Descriptor().Fields()
	wantOrnament := []string{"ornament_id", "kind", "acquisition", "price", "owned", "selected"}
	if ornamentFields.Len() != len(wantOrnament) {
		t.Fatalf("Ornament fields = %d, want exactly %d", ornamentFields.Len(), len(wantOrnament))
	}
	for i, want := range wantOrnament {
		if got := string(ornamentFields.Get(i).Name()); got != want {
			t.Errorf("Ornament field %d = %q, want %q", i, got, want)
		}
	}
	selectionFields := (&storev1.OrnamentSelection{}).ProtoReflect().Descriptor().Fields()
	if selectionFields.Len() != 2 {
		t.Fatalf("OrnamentSelection fields = %d, want exactly 2", selectionFields.Len())
	}

	// DecorateRequest is one named field per kind — the shape that makes a duplicate or unknown kind
	// unrepresentable. It only holds while the fields and the kinds stay in step: a kind with no
	// field of its own could never be saved, and the panel would silently revert it on every save.
	decorateFields := (&storev1.DecorateRequest{}).ProtoReflect().Descriptor().Fields()
	if decorateFields.Len() != len(store.AllOrnamentKinds()) {
		t.Fatalf("DecorateRequest fields = %d, want one per kind (%d)",
			decorateFields.Len(), len(store.AllOrnamentKinds()))
	}
	for _, kind := range store.AllOrnamentKinds() {
		want := strings.ToLower(string(kind)) + "_ornament_id"
		if decorateFields.ByName(protoreflect.Name(want)) == nil {
			t.Errorf("DecorateRequest has no %q field for kind %q", want, kind)
		}
	}

	file := (&storev1.Ornament{}).ProtoReflect().Descriptor().ParentFile()
	forbidden := []string{"user_id", "achievement", "color", "size", "brightness", "seed", "params"}
	forEachField(file.Messages(), func(message protoreflect.MessageDescriptor, field protoreflect.FieldDescriptor) {
		name := string(field.Name())
		for _, word := range forbidden {
			if strings.Contains(name, word) {
				t.Errorf("%s.%s names %q, which the decoration contract may not carry", message.Name(), name, word)
			}
		}
	})

	// No inventory message and no equip method: ownership is a bool on a catalog row ([P7]).
	for i := range file.Messages().Len() {
		if name := strings.ToLower(string(file.Messages().Get(i).Name())); strings.Contains(name, "inventory") {
			t.Errorf("the contract declares an inventory-shaped message %q", name)
		}
	}
	service := file.Services().Get(0)
	for i := range service.Methods().Len() {
		method := service.Methods().Get(i)
		if name := strings.ToLower(string(method.Name())); strings.Contains(name, "equip") {
			t.Errorf("the contract declares an equip method %q", name)
		}
	}
}

func forEachField(
	messages protoreflect.MessageDescriptors,
	visit func(protoreflect.MessageDescriptor, protoreflect.FieldDescriptor),
) {
	for i := range messages.Len() {
		message := messages.Get(i)
		for j := range message.Fields().Len() {
			visit(message, message.Fields().Get(j))
		}
		forEachField(message.Messages(), visit)
	}
}

func TestScopelessContextIsRefusedBeforeAnyRead(t *testing.T) {
	t.Parallel()
	if _, err := userScope(context.Background()); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("userScope err = %v, want unauthenticated", err)
	}
	scope, err := platform.NewUserScope("wire-user")
	if err != nil || scope.UserID() != "wire-user" {
		t.Fatalf("NewUserScope = %v, err %v", scope, err)
	}
}
