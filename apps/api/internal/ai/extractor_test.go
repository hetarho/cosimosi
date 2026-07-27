package ai

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform/values"
)

// The split prompt is the prompt-engineering half of the encode defense
// (policy/encode-boundary.md) — the schema cannot express "split at event boundaries" or
// "merge conservatively", so those rules only exist as prompt text and are only load-bearing
// while they are actually in it.
func TestSplitPromptCarriesTheExtractionPolicy(t *testing.T) {
	prompt := splitPrompt("오늘은 더웠다", time.Date(2026, 7, 27, 0, 0, 0, 0, time.UTC), nil)

	for name, fragment := range map[string]string{
		"event-boundary split [E1]":   "EVENT boundaries",
		"not an emotion split [E1]":   "Never split at a change of feeling",
		"name is a title [W2a]":       "SHORT TITLE",
		"the three neuron types [E3]": `"spatial"`,
		"time is not a neuron [E6]":   "Time is never a neuron",
		"conservative merge [E10]":    "never merely related concepts",
		"the diary body":              "오늘은 더웠다",
		"the diary date":              "2026-07-27",
	} {
		if !strings.Contains(prompt, fragment) {
			t.Errorf("split prompt is missing %s (%q)", name, fragment)
		}
	}
}

// The scene-count band is tuning ([E2], encode.min_memories/max_memories) and the use-case
// rejects a split outside it. A prompt that hardcodes a different band would burn revise
// retries on a rule the model was never told.
func TestSplitPromptStatesTheConfiguredSceneCount(t *testing.T) {
	prompt := splitPrompt("body", fixedNow(), nil)

	band := fmt.Sprintf("%d to %d memories", values.EncodeMinMemories, values.EncodeMaxMemories)
	if !strings.Contains(prompt, band) {
		t.Errorf("split prompt does not state the configured scene count %q", band)
	}
}

func TestSplitPromptRendersExistingNeuronsAsNameAndType(t *testing.T) {
	prompt := splitPrompt("body", fixedNow(), []memory.ExistingNeuron{
		{ID: "neuron-1", Name: "스타벅스", Type: memory.NeuronTypeSpatial, RepresentationRevision: 3},
	})

	if !strings.Contains(prompt, "- 스타벅스 (spatial)") {
		t.Error("split prompt does not list existing neurons as name (type) lines")
	}
	// Ids and revisions are dedup bookkeeping the model must not see — a struct dump leaks
	// them and invites the model to echo one back into a name.
	for _, leaked := range []string{"neuron-1", "RepresentationRevision"} {
		if strings.Contains(prompt, leaked) {
			t.Errorf("split prompt leaks internal neuron field %q", leaked)
		}
	}
}

func TestSplitPromptSaysSoWhenThereAreNoExistingNeurons(t *testing.T) {
	prompt := splitPrompt("body", fixedNow(), nil)

	if strings.Contains(prompt, "[]") {
		t.Error("split prompt renders an empty neuron list as a bare Go slice")
	}
	if !strings.Contains(prompt, "(none") {
		t.Error("split prompt does not tell the model the existing-neuron list is empty")
	}
}

// A revise re-enters the same enforcement loop, so the instruction must be applied on top of
// the rules rather than in place of them.
func TestRevisePromptRestatesTheRulesAndThePriorSplit(t *testing.T) {
	prior := memory.ExtractResult{Memories: []memory.ExtractedMemory{{
		Name:    "아침 출근길",
		Mood:    memory.MoodRelief,
		SourceText: "아침에 지하철을 탔다",
		Neurons:    []memory.ExtractedNeuron{{Name: "지하철", Type: memory.NeuronTypeSpatial}},
	}}}

	prompt := revisePrompt("아침 출근길 지하철을 탔다", prior, "출근길과 점심을 한 별로 합쳐줘")

	for name, fragment := range map[string]string{
		"the extraction rules":  "EVENT boundaries",
		"the whole-split rule":  "every memory, not just the changed ones",
		"the prior memory name": "아침 출근길",
		"the prior mood":        "RELIEF",
		"the prior neuron":      "지하철 (spatial)",
		"the prior passage":     "아침에 지하철을 탔다",
		"the instruction":       "출근길과 점심을 한 별로 합쳐줘",
		// A revise must re-quote from the diary; the prior split is what it is correcting.
		"the diary body": "아침 출근길 지하철을 탔다",
	} {
		if !strings.Contains(prompt, fragment) {
			t.Errorf("revise prompt is missing %s (%q)", name, fragment)
		}
	}
}
