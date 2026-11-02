package platform

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

const modulePath = "github.com/cosimosi/api/"

// platformValueGroups are the generated value groups platform owns; every other group is a product
// context's tuning and is read by that context or the composition root.
var platformValueGroups = []string{"Supabase"}

var (
	// productProcedurePath is a Connect procedure of a product service, or a bare method suffix
	// standing in for one ("/Recall").
	productProcedurePath = regexp.MustCompile(`^/(cosimosi\.[a-z]+\.v[0-9]+\.[A-Za-z]+/[A-Za-z]+|[A-Z][A-Za-z]+)$`)
	platformProcedure    = regexp.MustCompile(`^/cosimosi\.platform\.v[0-9]+\.`)
)

// ARCH-18: platform has no product dependency. Changing an admin search rule or adding a
// provider-backed RPC must never edit platform, so its sources may not import a product context or
// its generated API, read a product value group, or name a product procedure.
func TestPlatformCarriesNoProductKnowledge(t *testing.T) {
	t.Parallel()
	fset := token.NewFileSet()
	var offenders []string
	err := filepath.WalkDir(".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			// values is the generated table itself, not a reader of it.
			if path == "values" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		file, err := parser.ParseFile(fset, path, nil, 0)
		if err != nil {
			return err
		}
		offenders = append(offenders, productKnowledge(fset, file)...)
		return nil
	})
	if err != nil {
		t.Fatalf("walk platform sources: %v", err)
	}
	for _, offender := range offenders {
		t.Error(offender)
	}
}

func productKnowledge(fset *token.FileSet, file *ast.File) []string {
	var offenders []string
	report := func(node ast.Node, format string, args ...any) {
		offenders = append(offenders, fset.Position(node.Pos()).String()+": "+fmt.Sprintf(format, args...))
	}
	for _, spec := range file.Imports {
		path, _ := strconv.Unquote(spec.Path.Value)
		rest, internal := strings.CutPrefix(path, modulePath+"internal/")
		if !internal {
			continue
		}
		if !strings.HasPrefix(rest, "platform") && !strings.HasPrefix(rest, "gen/cosimosi/platform/") {
			report(spec, "imports product package %s", path)
		}
	}
	ast.Inspect(file, func(node ast.Node) bool {
		switch node := node.(type) {
		case *ast.SelectorExpr:
			pkg, ok := node.X.(*ast.Ident)
			if !ok || pkg.Name != "values" {
				return true
			}
			for _, group := range platformValueGroups {
				if strings.HasPrefix(node.Sel.Name, group) {
					return true
				}
			}
			report(node, "reads product value values.%s", node.Sel.Name)
		case *ast.BasicLit:
			if node.Kind != token.STRING {
				return true
			}
			value, err := strconv.Unquote(node.Value)
			if err == nil && productProcedurePath.MatchString(value) && !platformProcedure.MatchString(value) {
				report(node, "names product procedure %q", value)
			}
		}
		return true
	})
	return offenders
}
