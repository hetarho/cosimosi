package rpcserver

import (
	"strings"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
)

// MoodToProto maps a lowercase domain mood name to the transport enum.
func MoodToProto(mood string) cosimosiv1.Mood {
	if num, ok := cosimosiv1.Mood_value[strings.ToUpper(mood)]; ok {
		return cosimosiv1.Mood(num)
	}
	return cosimosiv1.Mood_MOOD_UNSPECIFIED
}

// MoodFromProto maps the transport enum to its lowercase domain name.
func MoodFromProto(m cosimosiv1.Mood) string {
	name, ok := cosimosiv1.Mood_name[int32(m)]
	if !ok || m == cosimosiv1.Mood_MOOD_UNSPECIFIED {
		return ""
	}
	return strings.ToLower(name)
}
