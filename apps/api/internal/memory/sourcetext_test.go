package memory

import (
	"errors"
	"strings"
	"testing"
)

// The diary the fidelity cases quote. Korean because that is what the rule has to survive: an
// eojeol carries its ending inline, so a legitimate cut-edge repair and an illegitimate word
// substitution both look like "the token changed" to anything cruder than this check.
const fidelityDiary = "출근길 지하철에 발을 디뎠고 시원한 에어컨 바람에 살 것 같았다. " +
	"점심에는 팀원들과 얼음이 가득한 냉모밀을 먹었는데 더위가 가셨다."

func passages(texts ...string) []ExtractedMemory {
	memories := make([]ExtractedMemory, 0, len(texts))
	for i, text := range texts {
		memories = append(memories, ExtractedMemory{Name: names[i%len(names)], SourceText: text})
	}
	return memories
}

var names = []string{"출근길", "점심"}

func TestSourceTextAcceptsTheWritersOwnWords(t *testing.T) {
	t.Parallel()
	cases := map[string][]string{
		"quoted verbatim": {
			"출근길 지하철에 발을 디뎠고 시원한 에어컨 바람에 살 것 같았다.",
			"점심에는 팀원들과 얼음이 가득한 냉모밀을 먹었는데 더위가 가셨다.",
		},
		"cut-edge ending repaired": {
			// "디뎠고," would dangle where the scene was cut, so the ending is closed.
			"출근길 지하철에 발을 디뎠다. 시원한 에어컨 바람에 살 것 같았다.",
			"점심에는 팀원들과 얼음이 가득한 냉모밀을 먹었다. 더위가 가셨다.",
		},
		"typo corrected": {
			"출근길 지하철에 발을 디뎠고 시원한 에어콘 바람에 살 것 같았다.",
			"점심에는 팀원들과 얼음이 가득한 냉모밀을 먹었는데 더위가 가셨다.",
		},
	}
	for name, texts := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if violation := SourceTextViolation(fidelityDiary, passages(texts...)); violation != "" {
				t.Errorf("rejected the writer's own words: %s", violation)
			}
		})
	}
}

func TestSourceTextRejectsWordsTheWriterDidNotUse(t *testing.T) {
	t.Parallel()
	cases := map[string]struct {
		texts []string
		// The word the check must name, so the re-prompt tells the model what to fix.
		wants string
	}{
		"synonym substituted": {
			// 냉모밀 → 메밀국수: the same dish, not the writer's word for it.
			texts: []string{
				"출근길 지하철에 발을 디뎠고 시원한 에어컨 바람에 살 것 같았다.",
				"점심에는 팀원들과 얼음이 가득한 메밀국수를 먹었는데 더위가 가셨다.",
			},
			wants: "메밀국수를",
		},
		"sentence invented": {
			texts: []string{
				"출근길 지하철에 발을 디뎠고 시원한 에어컨 바람에 살 것 같았다.",
				"점심에는 팀원들과 얼음이 가득한 냉모밀을 먹었는데 더위가 가셨다. 정말 행복한 하루였다.",
			},
			wants: "정말",
		},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			violation := SourceTextViolation(fidelityDiary, passages(testCase.texts...))
			if violation == "" {
				t.Fatal("accepted a passage the writer did not write")
			}
			if !strings.Contains(violation, testCase.wants) {
				t.Errorf("violation = %q, want it to name %q", violation, testCase.wants)
			}
		})
	}
}

// A paraphrase keeps most words and swaps a few, which is exactly what the per-passage budget
// exists for: no single swap is provably wrong, but a tenth of the passage moving is.
func TestSourceTextRejectsWholesaleRewordingWithinTheRepairShape(t *testing.T) {
	t.Parallel()
	body := "아침 공기 매우 차갑다 그리고 하늘 맑다 오늘 기분 좋다 정말 상쾌한 시작이다"
	reworded := "아침 공기가 매우 차갑고 그리고 하늘이 맑고 오늘 기분이 좋고 정말 상쾌한 시작이고"

	if violation := SourceTextViolation(body, passages(reworded)); violation == "" {
		t.Fatal("accepted a passage where every clause was reworded")
	}
}

func TestSourceTextRejectsADroppedScene(t *testing.T) {
	t.Parallel()
	// The lunch scene never made it into any passage — the split sampled the diary instead of
	// partitioning it, and the writer's afternoon would vanish at launch.
	violation := SourceTextViolation(fidelityDiary, passages(
		"출근길 지하철에 발을 디뎠고 시원한 에어컨 바람에 살 것 같았다.",
	))
	if violation == "" {
		t.Fatal("accepted a split that dropped half the diary")
	}
	if !strings.Contains(violation, "cover") {
		t.Errorf("violation = %q, want the coverage instruction", violation)
	}
}

// Coverage counts occurrences, not distinct words: repeating one scene's passage must not read
// as having covered the scenes it left out.
func TestSourceTextCoverageCountsOccurrences(t *testing.T) {
	t.Parallel()
	first := "출근길 지하철에 발을 디뎠고 시원한 에어컨 바람에 살 것 같았다."

	if violation := SourceTextViolation(fidelityDiary, passages(first, first)); violation == "" {
		t.Fatal("a passage repeated twice covered a diary it only half quotes")
	}
}

// A one-line diary splits into passages of a few words each, where a ratio alone would allow
// zero repairs and forbid the cut-edge ending the split itself creates.
func TestSourceTextRepairBudgetHasAFloorForShortPassages(t *testing.T) {
	t.Parallel()
	body := "비가 왔고 우산을 폈다"

	if violation := SourceTextViolation(body, passages("비가 왔다", "우산을 폈다")); violation != "" {
		t.Errorf("a short passage could not afford its cut-edge repair: %s", violation)
	}
}

func TestSourceTextIgnoresPunctuationAndSpacingDifferences(t *testing.T) {
	t.Parallel()
	body := "비가 왔다. 우산을 폈다!"

	if violation := SourceTextViolation(body, passages("비가 왔다", "우산을, 폈다...")); violation != "" {
		t.Errorf("punctuation counted as a word change: %s", violation)
	}
}

// A blank passage is a schema breach, not a judgement the model can be re-prompted out of, so
// validateSplitStructure rejects it outright before the fidelity rule ever sees the split.
func TestBlankSourceTextIsAStructuralBreach(t *testing.T) {
	t.Parallel()
	err := validateSplitStructure(ExtractResult{Memories: []ExtractedMemory{
		{Name: "a", Mood: MoodCalm, SourceText: "  ", Neurons: []ExtractedNeuron{{Name: "n", Type: NeuronTypeSemantic}}},
	}})
	if err == nil {
		t.Fatal("a whitespace-only passage must be rejected")
	}
	if !errors.Is(err, ErrEncodeInvalidSplit) {
		t.Errorf("err = %v, want ErrEncodeInvalidSplit — a blank passage is not re-promptable", err)
	}
}
