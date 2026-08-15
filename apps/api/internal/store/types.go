package store

import (
	"strings"
	"time"
)

// OrnamentID is opaque to the server: "<lower(kind)>.<registry key>". The prefix is the only part
// this context reads, and it reads it to learn the kind — the same fact the DDL CHECK enforces, so
// no `kind` column and no Kind field has to be stored beside an id. Cross-kind uniqueness (which
// ornament_ownerships' primary key depends on) follows from the prefix rather than from a test.
type OrnamentID string

// OrnamentKind is the closed set of surfaces decoration opens: the sky behind the universe, the body
// shape a memory is shown as, the body shape its summary is shown as, and the two halves of the
// decorative dust between them — one speck's look, and the space the specks are scattered through. A
// sixth kind cannot appear without amending this enum, the DDL CHECK and the proto in one reviewed
// change — and nothing meaning-bearing (a position, a strength, an emotion, a forgetting stage, a
// gist) is expressible as a kind at all ([P4][V10][I11]).
//
// Every name here is the SURFACE, never the renderer's own noun for what fills it: the looks are
// registry rows on the other side of the projection, and their words stay there (ARCHITECTURE §3.4).
//
// A feeling's color is deliberately NOT a kind: mood_colors owns the per-mood override, and an
// emotion color is not something to be sold ([P10] as amended).
type OrnamentKind string

// OrnamentAcquisition is how a row is come by. The two storable values are spelled exactly as
// ornament_ownerships.acquired_via stores them; FREE is never stored, because a free row is owned
// by everyone through the ABSENCE of a row ([P10]).
type OrnamentAcquisition string

const (
	KindBackground OrnamentKind = "BACKGROUND"
	KindStarShader OrnamentKind = "STAR_SHADER"
	KindGistShader OrnamentKind = "GIST_SHADER"
	KindMote       OrnamentKind = "MOTE"
	KindMoteField  OrnamentKind = "MOTE_FIELD"
)

const (
	AcquisitionFree        OrnamentAcquisition = "free"
	AcquisitionPurchase    OrnamentAcquisition = "purchase"
	AcquisitionAchievement OrnamentAcquisition = "achievement"
)

// Ornament is a catalog row: an id, its kind, and how it is come by. Three discrete fields, and
// that is the whole type.
//
// There is no Price field — a purchasable row is priced by its Kind ([P9]), so a per-row price is
// unrepresentable rather than merely unused. There is no Label, Blurb, PreviewURL, Color, Size,
// Brightness, Seed or Params field either: the server can NAME an ornament, never describe one.
type Ornament struct {
	ID          OrnamentID
	Kind        OrnamentKind
	Acquisition OrnamentAcquisition
}

// CatalogItem is one catalog row answered for one caller: the row, plus what is true of it for
// them. Every row is answered — owned and unowned alike — so the client renders one list of
// everything and reveals ownership through price alone ([P6][P7]).
type CatalogItem struct {
	Ornament
	// Price is resolved from Kind at read time, and is 0 for every FREE and ACHIEVEMENT row. The
	// client never holds the price table.
	Price int
	Owned bool
	// Selected is true for the one row of its kind the universe wears right now.
	Selected bool
}

// OrnamentSelection is what the universe wears for one kind. One row per kind is a primary-key
// fact, which is what makes "exactly one applied ornament per kind" structural ([P8]).
type OrnamentSelection struct {
	Kind       OrnamentKind
	OrnamentID OrnamentID
}

// OrnamentOwnership is a permanent membership row: acquired once, never expiring, never revoked
// ([P9]). It has no quantity and no end date, so permanence needs no enforcement.
type OrnamentOwnership struct {
	OrnamentID  OrnamentID
	AcquiredVia OrnamentAcquisition
	AcquiredAt  time.Time
}

// kindPrefix is the id prefix that binds a row to its kind — `lower(kind) || '.'`, exactly the
// expression ornament_selections' CHECK compares against.
func kindPrefix(kind OrnamentKind) string {
	return strings.ToLower(string(kind)) + "."
}
