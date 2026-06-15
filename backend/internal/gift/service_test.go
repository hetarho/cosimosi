package gift

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// --- fakes ----------------------------------------------------------------

// fakeStar registers an owned star's emotion/text so the fake repo can fold the sent fragment
// into GetByToken (the real view query does this via a JOIN).
type fakeStar struct {
	owner string
	text  string
	mood  string
}

type resPair struct{ giftID, senderMem, recipientMem string }

// fakeRepo models star_gifts + resonances + memory ownership in memory.
type fakeRepo struct {
	gifts  map[string]*Gift    // by token
	stars  map[string]fakeStar // memory_id → owner/text/mood
	res    []resPair
	nextID int
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{gifts: map[string]*Gift{}, stars: map[string]fakeStar{}}
}

func (f *fakeRepo) id(prefix string) string {
	f.nextID++
	return prefix + "-" + string(rune('a'+f.nextID))
}

// addStar registers an owned star (so it can be sent / resonated).
func (f *fakeRepo) addStar(memID, owner, text, mood string) {
	f.stars[memID] = fakeStar{owner: owner, text: text, mood: mood}
}

func (f *fakeRepo) CreateGift(_ context.Context, in CreateGiftInput) error {
	star, ok := f.stars[in.SenderMemoryID]
	if !ok || star.owner != in.SenderUserID {
		return ErrStarNotFound // ownership guard
	}
	f.gifts[in.Token] = &Gift{
		ID:             f.id("gift"),
		Token:          in.Token,
		SenderUserID:   in.SenderUserID,
		SenderMemoryID: in.SenderMemoryID,
		Message:        in.Message,
		Status:         StatusPending,
		FragmentText:   star.text,
		Mood:           star.mood,
		CreatedAt:      time.Now().UTC(),
		ExpiresAt:      in.ExpiresAt,
	}
	return nil
}

func (f *fakeRepo) GetByToken(_ context.Context, token string) (Gift, error) {
	g, ok := f.gifts[token]
	if !ok {
		return Gift{}, ErrNotFound
	}
	return *g, nil
}

func (f *fakeRepo) AcceptGift(_ context.Context, token, recipientUserID string, rw Rewrite, now time.Time) (AcceptResult, error) {
	g, ok := f.gifts[token]
	if !ok {
		return AcceptResult{}, ErrNotFound
	}
	if g.SenderUserID == recipientUserID {
		return AcceptResult{}, ErrSelfRespond
	}
	if err := actionable(*g, now); err != nil {
		return AcceptResult{}, err
	}
	recordID := f.id("record")
	memID := f.id("mem")
	f.addStar(memID, recipientUserID, rw.Text, rw.Mood) // the recipient's new star
	f.res = append(f.res, resPair{giftID: g.ID, senderMem: g.SenderMemoryID, recipientMem: memID})
	g.Status = StatusAccepted
	g.RecipientUserID = recipientUserID
	t := now
	g.RespondedAt = &t
	return AcceptResult{RecordID: recordID, MemoryID: memID}, nil
}

func (f *fakeRepo) DeclineGift(_ context.Context, token, recipientUserID string) (bool, error) {
	g, ok := f.gifts[token]
	if !ok || actionable(*g, time.Now().UTC()) != nil {
		return false, nil
	}
	g.Status = StatusDeclined
	g.RecipientUserID = recipientUserID
	t := time.Now().UTC()
	g.RespondedAt = &t
	return true, nil
}

func (f *fakeRepo) CancelGift(_ context.Context, giftID, senderUserID string) (bool, error) {
	for _, g := range f.gifts {
		if g.ID == giftID && g.SenderUserID == senderUserID && g.Status == StatusPending {
			g.Status = StatusCanceled
			t := time.Now().UTC()
			g.RespondedAt = &t
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeRepo) ListSent(_ context.Context, userID string) ([]GiftRecord, error) {
	var out []GiftRecord
	for _, g := range f.gifts {
		if g.SenderUserID == userID {
			out = append(out, GiftRecord{GiftID: g.ID, Token: g.Token, Status: g.Status, CounterpartUserID: g.RecipientUserID, Message: g.Message, CreatedAt: g.CreatedAt, ExpiresAt: g.ExpiresAt})
		}
	}
	return out, nil
}

func (f *fakeRepo) ListReceived(_ context.Context, userID string) ([]GiftRecord, error) {
	var out []GiftRecord
	for _, g := range f.gifts {
		if g.RecipientUserID == userID {
			out = append(out, GiftRecord{GiftID: g.ID, Token: g.Token, Status: g.Status, CounterpartUserID: g.SenderUserID, Message: g.Message, CreatedAt: g.CreatedAt, ExpiresAt: g.ExpiresAt})
		}
	}
	return out, nil
}

func (f *fakeRepo) ResonancePartnerUserID(_ context.Context, memoryID, userID string) (string, bool, error) {
	for _, r := range f.res {
		if r.senderMem == memoryID && f.stars[r.senderMem].owner == userID {
			return f.stars[r.recipientMem].owner, true, nil
		}
		if r.recipientMem == memoryID && f.stars[r.recipientMem].owner == userID {
			return f.stars[r.senderMem].owner, true, nil
		}
	}
	return "", false, nil
}

// fakeShare resolves a fixed display name / slug for any user.
type fakeShare struct {
	name    string
	slug    string
	enabled bool
	err     error
}

func (f fakeShare) DisplayInfo(context.Context, string) (string, string, bool, error) {
	return f.name, f.slug, f.enabled, f.err
}

func newSvc(repo Repository) *Service { return NewService(repo, fakeShare{name: "친구", slug: "abc", enabled: true}) }

// --- effectiveStatus (pure) ----------------------------------------------

func TestEffectiveStatus(t *testing.T) {
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)
	cases := []struct {
		name    string
		stored  GiftStatus
		expires time.Time
		want    GiftStatus
	}{
		{"pending & live", StatusPending, future, StatusPending},
		{"pending past expiry → expired", StatusPending, past, StatusExpired},
		{"accepted stays accepted (even past expiry)", StatusAccepted, past, StatusAccepted},
		{"declined stays declined", StatusDeclined, future, StatusDeclined},
		{"canceled stays canceled", StatusCanceled, past, StatusCanceled},
	}
	for _, c := range cases {
		if got := effectiveStatus(c.stored, c.expires, now); got != c.want {
			t.Errorf("%s: effectiveStatus=%q want %q", c.name, got, c.want)
		}
	}
}

// --- send + get ----------------------------------------------------------

// 1.1/1.2: a sent gift's link shows ONLY the sent fragment + sender name; the token is 22-char.
func TestSendAndGet_ShowsFragmentOnly(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "그날 우리는 바다를 봤다", "joy")
	svc := newSvc(repo)
	ctx := context.Background()

	token, err := svc.SendGift(ctx, "sender", "m1", "보고 싶었어")
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if len(token) != 22 {
		t.Fatalf("want 22-char token, got %q (len %d)", token, len(token))
	}
	v, err := svc.GetGift(ctx, token)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if v.Status != StatusPending {
		t.Fatalf("want pending, got %q", v.Status)
	}
	if v.FragmentText != "그날 우리는 바다를 봤다" || v.Mood != "joy" {
		t.Fatalf("want the sent fragment + mood, got text=%q mood=%q", v.FragmentText, v.Mood)
	}
	if v.SenderDisplayName != "친구" || v.Message != "보고 싶었어" {
		t.Fatalf("want sender name + message, got name=%q msg=%q", v.SenderDisplayName, v.Message)
	}
}

func TestSendGift_NotOwnedStar(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "someone-else", "x", "calm")
	svc := newSvc(repo)
	if _, err := svc.SendGift(context.Background(), "sender", "m1", ""); !errors.Is(err, ErrStarNotFound) {
		t.Fatalf("want ErrStarNotFound, got %v", err)
	}
}

func TestSendGift_MessageTooLong(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "calm")
	svc := newSvc(repo)
	long := strings.Repeat("가", maxMessageRunes+1)
	if _, err := svc.SendGift(context.Background(), "sender", "m1", long); !errors.Is(err, ErrMessageTooLong) {
		t.Fatalf("want ErrMessageTooLong, got %v", err)
	}
}

// 1.3: an unknown token is a UNIFORM NotFound (existence not advertised).
func TestGetGift_UnknownToken(t *testing.T) {
	svc := newSvc(newFakeRepo())
	if _, err := svc.GetGift(context.Background(), "nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// --- accept = rewrite ----------------------------------------------------

// 2.1/2.2: accept creates the recipient's star + the resonance; both ends then read resonant.
func TestAcceptGift_BirthsStarAndResonance(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "그날의 바다", "joy")
	svc := newSvc(repo)
	ctx := context.Background()

	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	res, err := svc.AcceptGift(ctx, "recipient", token, Rewrite{Text: "나는 그날 추웠다", Mood: "sad", Intensity: 0.6, Valence: -0.3})
	if err != nil {
		t.Fatalf("accept: %v", err)
	}
	if res.RecordID == "" || res.MemoryID == "" {
		t.Fatalf("want new record+memory ids, got %+v", res)
	}
	// Sender's star resonates (partner = recipient) and recipient's star resonates (partner = sender).
	if _, ok, _ := repo.ResonancePartnerUserID(ctx, "m1", "sender"); !ok {
		t.Fatal("sender's star should be resonant after accept")
	}
	if _, ok, _ := repo.ResonancePartnerUserID(ctx, res.MemoryID, "recipient"); !ok {
		t.Fatal("recipient's new star should be resonant after accept")
	}
	// The gift is now terminal — re-accept is rejected (idempotent refusal).
	if _, err := svc.AcceptGift(ctx, "recipient", token, Rewrite{Text: "again", Mood: "calm"}); !errors.Is(err, ErrNotPending) {
		t.Fatalf("re-accept must be ErrNotPending, got %v", err)
	}
	// And GetGift on a terminal gift reveals status ONLY — no fragment, no message, no sender name
	// (a used/retracted link must not survive as content or relationship metadata).
	v, _ := svc.GetGift(ctx, token)
	if v.Status != StatusAccepted || v.FragmentText != "" || v.Message != "" || v.SenderDisplayName != "" {
		t.Fatalf("terminal gift must show status only: %+v", v)
	}
}

// 2.3: you cannot accept your OWN gift.
func TestAcceptGift_SelfRejected(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	if _, err := svc.AcceptGift(ctx, "sender", token, Rewrite{Text: "mine", Mood: "joy"}); !errors.Is(err, ErrSelfRespond) {
		t.Fatalf("want ErrSelfRespond, got %v", err)
	}
}

func TestAcceptGift_EmptyText(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	token, _ := svc.SendGift(context.Background(), "sender", "m1", "")
	if _, err := svc.AcceptGift(context.Background(), "r", token, Rewrite{Text: "  ", Mood: "joy"}); !errors.Is(err, ErrEmptyText) {
		t.Fatalf("want ErrEmptyText, got %v", err)
	}
}

func TestAcceptGift_IntensityOutOfRange(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	token, _ := svc.SendGift(context.Background(), "sender", "m1", "")
	if _, err := svc.AcceptGift(context.Background(), "r", token, Rewrite{Text: "ok", Mood: "joy", Intensity: 1.5}); !errors.Is(err, ErrIntensityRange) {
		t.Fatalf("want ErrIntensityRange, got %v", err)
	}
}

// 1.3: an expired link is rejected on accept and shows expired (no content) on get.
func TestAcceptGift_Expired(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	repo.gifts[token].ExpiresAt = time.Now().UTC().Add(-time.Hour) // expire it

	if _, err := svc.AcceptGift(ctx, "r", token, Rewrite{Text: "ok", Mood: "joy"}); !errors.Is(err, ErrExpired) {
		t.Fatalf("want ErrExpired, got %v", err)
	}
	v, _ := svc.GetGift(ctx, token)
	if v.Status != StatusExpired || v.FragmentText != "" {
		t.Fatalf("expired gift must show expired + no content: status=%q text=%q", v.Status, v.FragmentText)
	}
}

// --- decline / cancel ----------------------------------------------------

func TestDeclineGift(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	if err := svc.DeclineGift(ctx, "r", token); err != nil {
		t.Fatalf("decline: %v", err)
	}
	if repo.gifts[token].Status != StatusDeclined {
		t.Fatalf("want declined, got %q", repo.gifts[token].Status)
	}
	// Accepting a declined gift is rejected.
	if _, err := svc.AcceptGift(ctx, "r", token, Rewrite{Text: "x", Mood: "joy"}); !errors.Is(err, ErrNotPending) {
		t.Fatalf("accept after decline must be ErrNotPending, got %v", err)
	}
}

func TestDeclineGift_SelfRejected(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	if err := svc.DeclineGift(ctx, "sender", token); !errors.Is(err, ErrSelfRespond) {
		t.Fatalf("want ErrSelfRespond, got %v", err)
	}
}

// 1.4: the sender can cancel a pending gift; the link then stops resolving as actionable.
func TestCancelGift(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	giftID := repo.gifts[token].ID

	if err := svc.CancelGift(ctx, "sender", giftID); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if _, err := svc.AcceptGift(ctx, "r", token, Rewrite{Text: "x", Mood: "joy"}); !errors.Is(err, ErrNotPending) {
		t.Fatalf("accept after cancel must be ErrNotPending, got %v", err)
	}
	// Canceling again (or a non-owner) → not cancelable.
	if err := svc.CancelGift(ctx, "sender", giftID); !errors.Is(err, ErrNotCancelable) {
		t.Fatalf("re-cancel must be ErrNotCancelable, got %v", err)
	}
	if err := svc.CancelGift(ctx, "intruder", "ghost"); !errors.Is(err, ErrNotCancelable) {
		t.Fatalf("cancel of a non-existent gift must be ErrNotCancelable, got %v", err)
	}
}

// --- list / resonance info ----------------------------------------------

func TestListGifts_FoldsStatusAndName(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "hi")
	_, _ = svc.AcceptGift(ctx, "recipient", token, Rewrite{Text: "ok", Mood: "calm"})

	sender, err := svc.ListGifts(ctx, "sender")
	if err != nil {
		t.Fatalf("list sent: %v", err)
	}
	if len(sender.Sent) != 1 || sender.Sent[0].Status != StatusAccepted {
		t.Fatalf("sender should see 1 accepted sent gift, got %+v", sender.Sent)
	}
	if sender.Sent[0].CounterpartDisplayName != "친구" {
		t.Fatalf("sent gift should carry the recipient display name, got %q", sender.Sent[0].CounterpartDisplayName)
	}
	recipient, _ := svc.ListGifts(ctx, "recipient")
	if len(recipient.Received) != 1 || recipient.Received[0].CounterpartDisplayName != "친구" {
		t.Fatalf("recipient should see 1 received gift with sender name, got %+v", recipient.Received)
	}
}

func TestGetResonanceInfo(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := newSvc(repo)
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	res, _ := svc.AcceptGift(ctx, "recipient", token, Rewrite{Text: "ok", Mood: "calm"})

	info, err := svc.GetResonanceInfo(ctx, "sender", "m1")
	if err != nil {
		t.Fatalf("resonance info: %v", err)
	}
	if !info.Resonant || info.PartnerDisplayName != "친구" || info.PartnerSlug != "abc" {
		t.Fatalf("want resonant + partner name/slug, got %+v", info)
	}
	// A non-resonant star reports resonant:false with no partner info.
	none, _ := svc.GetResonanceInfo(ctx, "recipient", "no-such-star")
	if none.Resonant {
		t.Fatalf("non-resonant star must report resonant:false, got %+v", none)
	}
	_ = res
}

// A partner who doesn't share publicly exposes a name but NO visit slug.
func TestGetResonanceInfo_PartnerNotSharing(t *testing.T) {
	repo := newFakeRepo()
	repo.addStar("m1", "sender", "x", "joy")
	svc := NewService(repo, fakeShare{name: "친구", slug: "abc", enabled: false})
	ctx := context.Background()
	token, _ := svc.SendGift(ctx, "sender", "m1", "")
	_, _ = svc.AcceptGift(ctx, "recipient", token, Rewrite{Text: "ok", Mood: "calm"})

	info, _ := svc.GetResonanceInfo(ctx, "sender", "m1")
	if !info.Resonant || info.PartnerSlug != "" {
		t.Fatalf("a non-sharing partner must expose no slug, got %+v", info)
	}
}
