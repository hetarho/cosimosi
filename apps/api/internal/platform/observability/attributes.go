package observability

import (
	"fmt"
	"strings"
)

type Attributes struct {
	values map[string]string
}

var sensitiveAttributeKeys = map[string]struct{}{
	"diarytext":              {},
	"diary":                  {},
	"recordbody":             {},
	"memorycontent":          {},
	"generatedmemorycontent": {},
	"rawembedding":           {},
	"embedding":              {},
	"token":                  {},
	"authtoken":              {},
	"accesstoken":            {},
	"idtoken":                {},
	"refreshtoken":           {},
	"authorization":          {},
	"apikey":                 {},
	"secret":                 {},
	"password":               {},
}

func NewAttributes(values map[string]string) (Attributes, error) {
	next := make(map[string]string, len(values))
	for key, value := range values {
		if _, blocked := sensitiveAttributeKeys[normalizeKey(key)]; blocked {
			return Attributes{}, fmt.Errorf("sensitive telemetry attribute is not allowed: %s", key)
		}
		next[key] = value
	}
	return Attributes{values: next}, nil
}

func MustAttributes(values map[string]string) Attributes {
	attrs, err := NewAttributes(values)
	if err != nil {
		panic(err)
	}
	return attrs
}

func (a Attributes) Values() map[string]string {
	values := make(map[string]string, len(a.values))
	for key, value := range a.values {
		values[key] = value
	}
	return values
}

func normalizeKey(key string) string {
	replacer := strings.NewReplacer("_", "", "-", "", " ", "")
	return strings.ToLower(replacer.Replace(key))
}
