package admin

import "strconv"

func itoa(v int) string { return strconv.Itoa(v) }

func boolStr(v bool) string { return strconv.FormatBool(v) }

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
