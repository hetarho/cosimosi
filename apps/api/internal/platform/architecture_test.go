package platform_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

func forbiddenCoreImports(file *ast.File) []string {
	var bad []string
	for _, spec := range file.Imports {
		path, err := strconv.Unquote(spec.Path.Value)
		if err != nil {
			panic(err)
		}
		if strings.Contains(path, "/internal/gen/") || strings.Contains(path, "/db/gen") || strings.Contains(path, "/internal/platform/db") || strings.Contains(path, "/pgx") || strings.HasPrefix(path, "connectrpc.com/") || strings.HasSuffix(path, "/pg") || strings.HasSuffix(path, "/rpc") {
			bad = append(bad, path)
		}
	}
	return bad
}

func TestProductContextsDependInward(t *testing.T) {
	_, current, _, _ := runtime.Caller(0)
	internal := filepath.Dir(filepath.Dir(current))
	for _, name := range []string{"memory", "account", "achievement", "store", "twinkle", "admin"} {
		err := filepath.WalkDir(filepath.Join(internal, name), func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				if entry.Name() == "pg" || entry.Name() == "rpc" {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
			if err != nil {
				return err
			}
			for _, imported := range forbiddenCoreImports(file) {
				t.Errorf("%s imports outer representation %s", path, imported)
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestInwardImportGuardParsesAliasesAndAllowsDomainPorts(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "probe.go", `package probe
import (
  alias "github.com/cosimosi/api/internal/memory/pg"
  _ "github.com/jackc/pgx/v5"
  "github.com/cosimosi/api/internal/platform"
)`, parser.ImportsOnly)
	if err != nil {
		t.Fatal(err)
	}
	if bad := forbiddenCoreImports(file); len(bad) != 2 {
		t.Fatalf("forbidden imports = %v", bad)
	}
}
