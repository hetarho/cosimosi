package job

import (
	"context"
	"log/slog"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/backend/internal/ai"
)

func day(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestTemporalBonus(t *testing.T) {
	base := day("2026-06-04")
	cases := []struct {
		name  string
		other time.Time
		want  float64
	}{
		{"same day", day("2026-06-04"), 0.3},
		{"3.5 days", base.Add(-84 * time.Hour), 0.15},
		{"exactly 7 days", day("2026-06-11"), 0.0},
		{"beyond a week", day("2026-07-01"), 0.0},
		{"symmetric (future)", day("2026-06-05"), 0.3 * (1 - 1.0/7.0)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := temporalBonus(base, c.other)
			if math.Abs(got-c.want) > 1e-9 {
				t.Fatalf("temporalBonus = %f, want %f", got, c.want)
			}
		})
	}
}

func TestInitialWeightClamp(t *testing.T) {
	// cos_sim 0.9 + bonus 0.3 = 1.2 → clamped to 1.0 (no emotion term: emoSim 0)
	if got := initialWeight(0.9, 0.3, 0); got != 1.0 {
		t.Fatalf("initialWeight over 1 = %f, want 1.0", got)
	}
	// cos_sim 0.75, no temporal bonus, no emotion term
	if got := initialWeight(0.75, 0.0, 0); math.Abs(got-0.75) > 1e-9 {
		t.Fatalf("initialWeight = %f, want 0.75", got)
	}
	// never negative
	if got := initialWeight(-0.5, 0.0, 0); got != 0.0 {
		t.Fatalf("initialWeight negative = %f, want 0.0", got)
	}
}

func TestBiasedLinksExcludesSelfAndComputesWeight(t *testing.T) {
	self := "mmm"
	date := day("2026-06-04")
	now := date.Add(2 * time.Hour)
	neighbors := []Neighbor{
		{MemoryID: "aaa", CosSim: 0.8, EntryDate: date},
		{MemoryID: "zzz", CosSim: 0.9, EntryDate: date},
		{MemoryID: "mmm", CosSim: 1.0, EntryDate: date}, // self → dropped
	}
	links := biasedLinks(self, "user-1", date, now, neighbors, map[string]string{}, map[string]float64{}, 0, 0, 0)
	if len(links) != 2 {
		t.Fatalf("got %d links, want 2 (self excluded)", len(links))
	}
	for _, l := range links {
		// biasedLinks does NOT normalize order — it emits (self, neighbor); the DB
		// normalizes with LEAST/GREATEST. So AID is always self here.
		if l.AID != self {
			t.Fatalf("AID = %q, want self %q", l.AID, self)
		}
		if l.BID != "aaa" && l.BID != "zzz" {
			t.Fatalf("unexpected neighbor BID %q", l.BID)
		}
		if l.UserID != "user-1" {
			t.Fatalf("user_id not carried: %q", l.UserID)
		}
		// Same-day neighbors get cos_sim + 0.3, clamped to 1.0, then capped below
		// the intra-entry binding 0.8 (spec 21, acceptance 1.3).
		if l.Weight != semanticWeightCap {
			t.Fatalf("same-day high-sim weight = %f, want cap %f", l.Weight, semanticWeightCap)
		}
	}
}

// Cross-entry semantic links must stay strictly below the intra-entry 0.8 no
// matter how similar the texts are (spec 21, acceptance 1.3).
func TestBiasedLinksCapsBelowIntraEntryWeight(t *testing.T) {
	date := day("2026-06-04")
	now := date.Add(2 * time.Hour)
	links := biasedLinks("self", "u", date, now, []Neighbor{{MemoryID: "n", CosSim: 1.0, EntryDate: date}}, map[string]string{}, map[string]float64{}, 0, 0, 0)
	if len(links) != 1 || links[0].Weight >= 0.8 {
		t.Fatalf("semantic weight %v, want < 0.8", links)
	}
	// Below the cap the weight is untouched (30-day gap → temporalBonus 0; opposite affect →
	// emoSim 0 → no emotion term → w0 = cos_sim). self=(1,1) vs neighbor=(-1,0) is max affect distance.
	links = biasedLinks("self", "u", date.AddDate(0, 0, 30), now, []Neighbor{{MemoryID: "n", CosSim: 0.75, EntryDate: date, Valence: -1, Intensity: 0}}, map[string]string{}, map[string]float64{}, 0, 1, 1)
	if links[0].Weight != 0.75 {
		t.Fatalf("uncapped weight = %f, want 0.75", links[0].Weight)
	}
}

// change 21 — emotion similarity raises a link's weight (A1) but never past the
// semanticWeightCap (A2). Two candidates with identical cos_sim and time, differing only in
// affect: the one closer to the new star's emotion links a touch stronger.
func TestBiasedLinksEmotionSimilarityRaisesWeight(t *testing.T) {
	date := day("2026-06-04")
	d30 := date.AddDate(0, 0, 30) // 30-day gap → temporalBonus 0, isolating the emotion term
	now := date.Add(2 * time.Hour)
	selfV, selfI := 0.8, 0.7 // the new star's affect (joy-ish)

	near := biasedLinks("self", "u", d30, now,
		[]Neighbor{{MemoryID: "near", CosSim: 0.75, EntryDate: date, Valence: 0.8, Intensity: 0.7}},
		map[string]string{}, map[string]float64{}, 0, selfV, selfI)[0].Weight
	far := biasedLinks("self", "u", d30, now,
		[]Neighbor{{MemoryID: "far", CosSim: 0.75, EntryDate: date, Valence: -0.8, Intensity: 0.1}},
		map[string]string{}, map[string]float64{}, 0, selfV, selfI)[0].Weight

	if !(near > far) {
		t.Fatalf("emotion-closer weight %f should exceed farther %f (A1)", near, far)
	}
	if near > semanticWeightCap {
		t.Fatalf("emotion term pushed weight %f past cap %f (A2)", near, semanticWeightCap)
	}
}

// emotionSimilarity is the affect-circumplex closeness in [0,1]: identical = 1, opposite
// corners = 0, symmetric (change 21).
func TestEmotionSimilarity(t *testing.T) {
	if got := emotionSimilarity(0.5, 0.5, 0.5, 0.5); math.Abs(got-1) > 1e-9 {
		t.Fatalf("identical affect = %f, want 1", got)
	}
	if got := emotionSimilarity(1, 1, -1, 0); math.Abs(got) > 1e-9 {
		t.Fatalf("opposite corners = %f, want 0", got)
	}
	if emotionSimilarity(0.2, 0.3, -0.6, 0.9) != emotionSimilarity(-0.6, 0.9, 0.2, 0.3) {
		t.Fatal("emotionSimilarity must be symmetric")
	}
}

// --- extract fan-out helpers (spec 21) ---

func TestToSegmentsMapsAllFields(t *testing.T) {
	segs := toSegments([]ai.Segment{
		{Index: 0, Text: "아침", Mood: ai.MoodCalm, Intensity: 0.4, Valence: 0.5},
		{Index: 1, Text: "오후", Mood: ai.MoodAnger, Intensity: 0.8, Valence: -0.7},
	})
	if len(segs) != 2 {
		t.Fatalf("got %d segments, want 2", len(segs))
	}
	if segs[1].Index != 1 || segs[1].Text != "오후" || segs[1].Mood != "anger" ||
		segs[1].Intensity != 0.8 || segs[1].Valence != -0.7 {
		t.Fatalf("segment not mapped: %+v", segs[1])
	}
}

func TestApplyManualHintOnlyOnDegradedShape(t *testing.T) {
	hint := RecordForExtract{HintMood: "joy", HintIntensity: 0.7, HintValence: 0.6}

	// Degraded shape (single neutral segment) → hint applies.
	got := applyManualHint([]Segment{{Text: "t", Mood: "neutral"}}, hint)
	if got[0].Mood != "joy" || got[0].Intensity != 0.7 || got[0].Valence != 0.6 {
		t.Fatalf("hint not applied on degraded shape: %+v", got[0])
	}

	// Real multi-fragment extraction → untouched.
	multi := applyManualHint([]Segment{{Mood: "calm"}, {Mood: "anger"}}, hint)
	if multi[0].Mood != "calm" || multi[1].Mood != "anger" {
		t.Fatalf("multi-fragment extraction was overridden: %+v", multi)
	}

	// Single segment with REAL detected affect (non-neutral mood or valence) → untouched.
	real := applyManualHint([]Segment{{Mood: "sad", Intensity: 0.3, Valence: -0.4}}, hint)
	if real[0].Mood != "sad" || real[0].Valence != -0.4 {
		t.Fatalf("detected affect was overridden: %+v", real[0])
	}

	// No hint → degraded shape stays neutral.
	none := applyManualHint([]Segment{{Mood: "neutral"}}, RecordForExtract{})
	if none[0].Mood != "neutral" || none[0].Valence != 0 {
		t.Fatalf("no-hint fallback mutated: %+v", none[0])
	}
}

func TestBackoffDelayGrowsAndCaps(t *testing.T) {
	base := 2 * time.Second
	max := 5 * time.Minute
	if d := backoffDelay(1, base, max); d != 2*time.Second { // base·2^0
		t.Fatalf("attempt 1 backoff = %v, want 2s", d)
	}
	if d := backoffDelay(2, base, max); d != 4*time.Second { // base·2^1
		t.Fatalf("attempt 2 backoff = %v, want 4s", d)
	}
	if d := backoffDelay(3, base, max); d != 8*time.Second { // base·2^2
		t.Fatalf("attempt 3 backoff = %v, want 8s", d)
	}
	if d := backoffDelay(100, base, max); d != max { // overflow guard → cap
		t.Fatalf("huge attempt backoff = %v, want cap %v", d, max)
	}
	if d := backoffDelay(20, base, max); d != max { // base·2^19 ≫ 5m → cap
		t.Fatalf("attempt 20 backoff = %v, want cap %v", d, max)
	}
}

// --- panic recovery (17, acceptance 2.7) ---

// stubJobs hands out one job and records how it was failed.
type stubJobs struct {
	failStatus Status
	failMsg    string
	failed     bool
}

func (s *stubJobs) Claim(_ context.Context, kind Kind) (Job, error) {
	// Only the embed queue has work — processOne probes extract first (spec 21).
	if kind == KindExtract {
		return Job{}, ErrNoJob
	}
	return Job{ID: "j1", Kind: kind, MemoryID: "m1"}, nil
}
func (s *stubJobs) Complete(context.Context, string) error { return nil }
func (s *stubJobs) Fail(_ context.Context, _ string, status Status, msg string, _ time.Time) error {
	s.failed = true
	s.failStatus = status
	s.failMsg = msg
	return nil
}
func (s *stubJobs) Stats(context.Context) (QueueStats, error) { return QueueStats{}, nil }

type stubStore struct{}

func (stubStore) GetRecordForExtract(context.Context, string) (RecordForExtract, error) {
	return RecordForExtract{UserID: "u1", Body: "body", EntryDate: day("2026-06-04")}, nil
}
func (stubStore) FragmentIDs(context.Context, string) ([]string, error) { return nil, nil }
func (stubStore) FanOutFragments(_ context.Context, _, _ string, segs []Segment) ([]string, error) {
	return make([]string, len(segs)), nil
}
func (stubStore) GetMemoryForEmbed(context.Context, string) (MemoryForEmbed, error) {
	return MemoryForEmbed{UserID: "u1", Text: "body", EntryDate: day("2026-06-04")}, nil
}
func (stubStore) UpsertEmbedding(context.Context, string, string, []float32, string) error {
	return nil
}
func (stubStore) KnnNearest(context.Context, string, []float32, string, int) ([]Neighbor, error) {
	return nil, nil
}
func (stubStore) LoadExcitabilityInputs(context.Context, string, []string) (ExcitabilityInputs, error) {
	return ExcitabilityInputs{Recalled: map[string]time.Time{}}, nil
}
func (stubStore) BatchUpsertLinks(context.Context, []LinkUpsert) error { return nil }
func (stubStore) LoadConsolidateGraph(context.Context, string) (ConsolidateGraph, error) {
	return ConsolidateGraph{}, nil
}
func (stubStore) ReknnCandidates(context.Context, string, time.Time, float64) ([]ReknnCandidate, error) {
	return nil, nil
}
func (stubStore) RunConsolidation(context.Context, string, string, ConsolidationWrite) (int, error) {
	return 0, nil
}
func (stubStore) GetRewriteInput(context.Context, string) (RewriteInput, error) {
	return RewriteInput{}, nil
}
func (stubStore) ApplyRewrite(context.Context, string, string, string, string) error { return nil }

// panicEmbedder simulates an adapter blowing up mid-pipeline.
type panicEmbedder struct{}

func (panicEmbedder) Embed(context.Context, string) ([]float32, error) { panic("boom") }
func (panicEmbedder) Dim() int                                         { return 3 }
func (panicEmbedder) Model() string                                    { return "panic-test" }

// A panicking job must not kill the process (the single binary runs API+worker):
// it becomes a normal backoff failure (pending retry on the first attempt).
func TestProcessOneRecoversFromPanic(t *testing.T) {
	jobs := &stubJobs{}
	w := NewWorker(jobs, stubStore{}, panicEmbedder{}, ai.NoopExtractor{}, ai.NoopRewriter{}, slog.New(slog.DiscardHandler))
	if claimed := w.processOne(context.Background()); !claimed {
		t.Fatal("processOne = false, want true (a job was claimed)")
	}
	if !jobs.failed {
		t.Fatal("panicking job was not handed to failWithBackoff")
	}
	if jobs.failStatus != StatusPending {
		t.Fatalf("first-attempt panic status = %q, want pending (backoff retry)", jobs.failStatus)
	}
	if !strings.Contains(jobs.failMsg, "panic") {
		t.Fatalf("failure message %q does not mention the panic", jobs.failMsg)
	}
}
