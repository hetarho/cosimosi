package apperr

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestHandwrittenBoundariesUseAppErrorConstructors prevents new RPC handlers from bypassing
// the taxonomy. Generated code, tests, and this constructor package are intentionally excluded.
func TestHandwrittenBoundariesUseAppErrorConstructors(t *testing.T) {
	t.Parallel()

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate audit test")
	}
	moduleRoot := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", ".."))
	internalRoot := filepath.Join(moduleRoot, "internal")
	constructorRoot := filepath.Join(internalRoot, "platform", "apperr")

	err := filepath.WalkDir(internalRoot, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if path == constructorRoot || entry.Name() == "gen" {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		source, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		text := string(source)
		if strings.Contains(text, "connect.NewError(") || strings.Contains(text, "connect.NewErrorf(") {
			relative, relativeErr := filepath.Rel(moduleRoot, path)
			if relativeErr != nil {
				relative = path
			}
			t.Errorf("%s constructs a raw Connect error; use platform/apperr", relative)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestContextRPCMappingsKeepAnExplicitInternalFallback(t *testing.T) {
	t.Parallel()

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate audit test")
	}
	moduleRoot := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", ".."))
	for _, contextName := range []string{"account", "admin", "memory", "twinkle"} {
		path := filepath.Join(moduleRoot, "internal", contextName, "rpc", "server.go")
		source, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(source), "return apperr.Internal(err)") {
			t.Errorf("%s/rpc/server.go has no explicit apperr.Internal fallback", contextName)
		}
	}
}
