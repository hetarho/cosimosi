package apperr

import (
	"errors"
	"testing"

	"connectrpc.com/connect"
	platformv1 "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1"
	"google.golang.org/protobuf/types/known/durationpb"
)

func TestDomainBuildsStableDetailAndCopiesMetadata(t *testing.T) {
	t.Parallel()

	metadata := map[string]string{"operation": "recall"}
	err := Domain(connect.CodeFailedPrecondition, "MEMORY_SYNC_CONSENT_REQUIRED", errors.New("consent required"), metadata)
	metadata["operation"] = "changed"

	if got := connect.CodeOf(err); got != connect.CodeFailedPrecondition {
		t.Fatalf("code = %s", got)
	}
	info := requireInfo(t, err)
	if info.GetReason() != "MEMORY_SYNC_CONSENT_REQUIRED" || info.GetDomain() != "memory" {
		t.Fatalf("info = %#v", info)
	}
	if got := info.GetMetadata()["operation"]; got != "recall" {
		t.Fatalf("metadata operation = %q", got)
	}
}

func TestInternalPreservesCauseForOuterInterceptor(t *testing.T) {
	t.Parallel()

	err := Internal(errors.New("database exploded"))
	if got := connect.CodeOf(err); got != connect.CodeInternal {
		t.Fatalf("code = %s", got)
	}
	if got := err.Error(); got != "internal: database exploded" {
		t.Fatalf("error = %q", got)
	}
	info := requireInfo(t, err)
	if info.GetReason() != ReasonInternal || info.GetDomain() != "platform" {
		t.Fatalf("info = %#v", info)
	}
}

func TestWithRequestIDReplacesDuplicateInfoAndPreservesOtherDetails(t *testing.T) {
	t.Parallel()

	err := Domain(connect.CodeNotFound, "MEMORY_RECALL_MEMORY_NOT_FOUND", errors.New("not found"), nil)
	connectErr := err.(*connect.Error)
	duplicate, duplicateErr := connect.NewErrorDetail(&platformv1.ErrorInfo{Reason: "DUPLICATE"})
	if duplicateErr != nil {
		t.Fatal(duplicateErr)
	}
	connectErr.AddDetail(duplicate)
	other, otherErr := connect.NewErrorDetail(durationpb.New(0))
	if otherErr != nil {
		t.Fatal(otherErr)
	}
	connectErr.AddDetail(other)
	connectErr.Meta().Set("X-Test", "kept")

	enriched := WithRequestID(err, "request-123")
	info := requireInfo(t, enriched)
	if info.GetRequestId() != "request-123" || info.GetReason() != "MEMORY_RECALL_MEMORY_NOT_FOUND" {
		t.Fatalf("info = %#v", info)
	}
	enrichedConnect := enriched.(*connect.Error)
	if got := enrichedConnect.Meta().Get("X-Test"); got != "kept" {
		t.Fatalf("metadata = %q", got)
	}
	if got := countInfoDetails(t, enrichedConnect); got != 1 {
		t.Fatalf("ErrorInfo detail count = %d", got)
	}
	if got := len(enrichedConnect.Details()); got != 2 {
		t.Fatalf("all detail count = %d", got)
	}

	reenriched := WithRequestID(enriched, "request-456")
	reenrichedInfo := requireInfo(t, reenriched)
	if reenrichedInfo.GetRequestId() != "request-456" {
		t.Fatalf("re-enriched request id = %q", reenrichedInfo.GetRequestId())
	}
	if got := countInfoDetails(t, reenriched.(*connect.Error)); got != 1 {
		t.Fatalf("re-enriched ErrorInfo detail count = %d", got)
	}
	if got := requireInfo(t, enriched).GetRequestId(); got != "request-123" {
		t.Fatalf("prior error was mutated during re-enrichment: request id = %q", got)
	}
}

func TestWithRequestIDAddsPlatformFallback(t *testing.T) {
	t.Parallel()

	err := WithRequestID(connect.NewError(connect.CodeUnauthenticated, errors.New("unauthenticated")), "request-auth")
	info := requireInfo(t, err)
	if info.GetReason() != "PLATFORM_UNAUTHENTICATED" || info.GetDomain() != "platform" || info.GetRequestId() != "request-auth" {
		t.Fatalf("info = %#v", info)
	}
}

func TestExposeDetailFailsClosed(t *testing.T) {
	for _, testCase := range []struct {
		value string
		want  bool
	}{
		{value: "", want: false},
		{value: "production", want: false},
		{value: "VERBOSE", want: false},
		{value: DetailVerbose, want: true},
	} {
		t.Run(testCase.value, func(t *testing.T) {
			t.Setenv(EnvErrorDetail, testCase.value)
			if got := ExposeDetail(); got != testCase.want {
				t.Fatalf("ExposeDetail() = %t, want %t", got, testCase.want)
			}
		})
	}
}

func requireInfo(t *testing.T, err error) *platformv1.ErrorInfo {
	t.Helper()
	info, ok := Info(err)
	if !ok {
		t.Fatal("ErrorInfo missing")
	}
	return info
}

func countInfoDetails(t *testing.T, connectErr *connect.Error) int {
	t.Helper()
	count := 0
	for _, detail := range connectErr.Details() {
		value, err := detail.Value()
		if err != nil {
			t.Fatal(err)
		}
		if _, ok := value.(*platformv1.ErrorInfo); ok {
			count++
		}
	}
	return count
}
