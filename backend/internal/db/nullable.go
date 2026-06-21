package db

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// StringPtr stores "" as NULL.
func StringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// StringValue reads NULL as "".
func StringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Float32Ptr stores the value as-is.
func Float32Ptr(v float64) *float32 {
	f := float32(v)
	return &f
}

// NonZeroFloat32Ptr stores 0 as NULL.
func NonZeroFloat32Ptr(v float64) *float32 {
	if v == 0 {
		return nil
	}
	return Float32Ptr(v)
}

// Float64Value reads NULL as 0.
func Float64Value(f *float32) float64 {
	if f == nil {
		return 0
	}
	return float64(*f)
}

// Float64Ptr reads NULL as nil.
func Float64Ptr(f *float32) *float64 {
	if f == nil {
		return nil
	}
	v := float64(*f)
	return &v
}

// TimePtr reads NULL timestamptz as nil.
func TimePtr(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}
