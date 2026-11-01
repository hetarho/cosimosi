package memory

import (
	"context"
	"fmt"
	"github.com/cosimosi/api/internal/platform"
	"strings"
	"testing"
	"time"
)

type generatedExportReader struct {
	count int
	body  string
}

func (r generatedExportReader) WalkExport(ctx context.Context, _ platform.UserScope, visit func(ExportDiary, []ExportMemory) error) error {
	day := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	for i := 0; i < r.count; i++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := visit(ExportDiary{ID: fmt.Sprintf("d-%d", i), Body: r.body, DiaryDate: day}, nil); err != nil {
			return err
		}
	}
	return nil
}
func BenchmarkExportRetainedDiaries(b *testing.B) {
	for _, count := range []int{100, 1000, 10000} {
		b.Run(fmt.Sprint(count), func(b *testing.B) {
			reader := generatedExportReader{count: count, body: strings.Repeat("A retained record. ", 100)}
			service, err := NewExportService(reader)
			if err != nil {
				b.Fatal(err)
			}
			scope, err := platform.NewUserScope("benchmark")
			if err != nil {
				b.Fatal(err)
			}
			b.ReportAllocs()
			for b.Loop() {
				result, err := service.Export(context.Background(), scope, ExportFormatMD)
				if err != nil {
					b.Fatal(err)
				}
				b.SetBytes(int64(len(result.Content)))
			}
		})
	}
}
