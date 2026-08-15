package store

import (
	"fmt"
	"slices"
	"strings"

	"github.com/cosimosi/api/internal/platform/values"
)

// The catalog is CODE, not a table — there is nothing per-user about which ornaments exist, so a
// table would only be a second place for the renderer's registries to drift from. Membership is a
// rule, never a count: one row per id the five registries publish
// (the renderer's SKY_EFFECTS, STAR_SHAPES, GIST_SHAPES, BACKDROP_MOTES and BACKDROP_FIELDS
// registries), with no number declared or asserted anywhere. testdata/ornament-ids.json is what
// keeps this list and those registries from parting: ONE file, read by both runtimes, so a renamed or
// dropped key fails a test on each.
//
// Duplicate ids are a COMPILE error here (a repeated constant key in a map literal), which is also
// why the table is a literal rather than a slice folded into a map.

// One default per kind, each mirroring its registry's OWN default — the catalog invents none. These
// are contract constants, not tuning: `account.DefaultPaletteID`'s shipped rationale, verbatim. An
// absent selection row IS the default, so no row is ever written for one.
const (
	// DefaultBackgroundOrnamentID mirrors DEFAULT_SKY_EFFECT, which is also the `emotion` skin's
	// authored sky.effect — a test on the FE side pins the two together.
	DefaultBackgroundOrnamentID OrnamentID = "background.grainient"
	// DefaultStarShaderOrnamentID mirrors DEFAULT_STAR_SHAPE. It is `facet`, not `orb`: orb stays in
	// the registry as the bench baseline (it IS the primitive body source) without being what a
	// universe opens on.
	DefaultStarShaderOrnamentID OrnamentID = "star_shader.facet"
	// DefaultGistShaderOrnamentID mirrors DEFAULT_GIST_SHAPE — the original shipped gist body, so an
	// undecorated universe's summaries look exactly as they did before this kind existed.
	DefaultGistShaderOrnamentID OrnamentID = "gist_shader.halo"
	// DefaultMoteOrnamentID mirrors DEFAULT_BACKDROP_MOTE: the plain distant speck, the row every
	// other one is read against.
	DefaultMoteOrnamentID OrnamentID = "mote.pinprick"
	// DefaultMoteFieldOrnamentID mirrors DEFAULT_BACKDROP_FIELD: the plain sky, evenly filled.
	DefaultMoteFieldOrnamentID OrnamentID = "mote_field.even"
)

// ornamentKinds is the closed set in the order every read answers in — the panel's group order, so
// it descends from what a memory IS toward the dust behind it.
var ornamentKinds = []OrnamentKind{
	KindBackground,
	KindStarShader,
	KindGistShader,
	KindMote,
	KindMoteField,
}

// kindDefaults and kindPrices are the two per-kind facts the catalog resolves. A price BY KIND is
// what makes [P9]'s "no per-row price" structural: one number moves a whole kind, and there is no
// second place a number could hide.
var (
	kindDefaults = map[OrnamentKind]OrnamentID{
		KindBackground: DefaultBackgroundOrnamentID,
		KindStarShader: DefaultStarShaderOrnamentID,
		KindGistShader: DefaultGistShaderOrnamentID,
		KindMote:       DefaultMoteOrnamentID,
		KindMoteField:  DefaultMoteFieldOrnamentID,
	}
	kindPrices = map[OrnamentKind]int{
		KindBackground: values.StoreBackgroundPrice,
		KindStarShader: values.StoreStarShaderPrice,
		KindGistShader: values.StoreGistShaderPrice,
		KindMote:       values.StoreMotePrice,
		KindMoteField:  values.StoreMoteFieldPrice,
	}
)

// ornamentAcquisitions is the catalog: every published id, and how it is come by. Each registry's
// own default is FREE; the two pinned capstone rewards are ACHIEVEMENT; everything else is bought
// at its kind's price.
//
// The two ACHIEVEMENT rows are the only unbuyable ones, and they stayed two when the kinds went
// from two to five: an achievement-only row exists because a capstone pays it, so a kind gets one
// when an achievement is written for it and not because the kind arrived. `store` never names the
// achievement that pays them either — the direction is one-way, so there is no achievement id here
// to drift from the other catalog.
var ornamentAcquisitions = map[OrnamentID]OrnamentAcquisition{
	"background.grainient":       AcquisitionFree,
	"background.grainstorm":      AcquisitionPurchase,
	"background.iridescence":     AcquisitionPurchase,
	"background.soft-aurora":     AcquisitionPurchase,
	"background.liquid-ether":    AcquisitionPurchase,
	"background.prismatic-burst": AcquisitionPurchase,
	"background.plasma-wave":     AcquisitionPurchase,
	"background.ferrofluid":      AcquisitionPurchase,
	"background.floating-lines":  AcquisitionAchievement,
	"background.evil-eye":        AcquisitionPurchase,
	"background.lightfall":       AcquisitionPurchase,
	"background.pixel-blast":     AcquisitionPurchase,

	"star_shader.orb":     AcquisitionPurchase,
	"star_shader.facet":   AcquisitionFree,
	"star_shader.prism":   AcquisitionPurchase,
	"star_shader.geode":   AcquisitionPurchase,
	"star_shader.bubble":  AcquisitionPurchase,
	"star_shader.spire":   AcquisitionAchievement,
	"star_shader.urchin":  AcquisitionPurchase,
	"star_shader.plasma":  AcquisitionPurchase,
	"star_shader.contour": AcquisitionPurchase,
	"star_shader.haze":    AcquisitionPurchase,

	"gist_shader.halo":   AcquisitionFree,
	"gist_shader.bead":   AcquisitionPurchase,
	"gist_shader.ring":   AcquisitionPurchase,
	"gist_shader.corona": AcquisitionPurchase,
	"gist_shader.echo":   AcquisitionPurchase,
	"gist_shader.pearl":  AcquisitionPurchase,
	"gist_shader.lens":   AcquisitionPurchase,

	"mote.pinprick":    AcquisitionFree,
	"mote.orb":         AcquisitionPurchase,
	"mote.ice-spark":   AcquisitionPurchase,
	"mote.ember-dust":  AcquisitionPurchase,
	"mote.galaxy-dust": AcquisitionPurchase,
	"mote.rose-mote":   AcquisitionPurchase,
	"mote.pixel":       AcquisitionPurchase,
	"mote.ember-chip":  AcquisitionPurchase,
	"mote.prism-shard": AcquisitionPurchase,
	"mote.ice-needle":  AcquisitionPurchase,
	"mote.wide-streak": AcquisitionPurchase,
	"mote.diffraction": AcquisitionPurchase,
	"mote.ember-bokeh": AcquisitionPurchase,

	"mote_field.even":      AcquisitionFree,
	"mote_field.sparse":    AcquisitionPurchase,
	"mote_field.packed":    AcquisitionPurchase,
	"mote_field.empty":     AcquisitionPurchase,
	"mote_field.milky-way": AcquisitionPurchase,
	"mote_field.spiral":    AcquisitionPurchase,
	"mote_field.dome":      AcquisitionPurchase,
	"mote_field.haze":      AcquisitionPurchase,
	"mote_field.frantic":   AcquisitionPurchase,
}

var (
	ornamentCatalog = buildCatalog()
	catalogIDs      = sortedCatalogIDs()
)

// buildCatalog resolves each id's kind from its prefix. It panics on a malformed table because a
// row whose prefix names no kind is a programming error the DDL CHECK would reject anyway — better
// at first import than on a user's write.
func buildCatalog() map[OrnamentID]Ornament {
	for _, kind := range ornamentKinds {
		if _, ok := kindDefaults[kind]; !ok {
			panic(fmt.Sprintf("store: ornament kind %q has no default id", kind))
		}
		// A kind with no price entry would silently sell its whole set for nothing.
		if _, ok := kindPrices[kind]; !ok {
			panic(fmt.Sprintf("store: ornament kind %q has no price", kind))
		}
	}
	catalog := make(map[OrnamentID]Ornament, len(ornamentAcquisitions))
	for id, acquisition := range ornamentAcquisitions {
		kind, ok := kindOf(id)
		if !ok {
			panic(fmt.Sprintf("store: ornament id %q carries no kind prefix", id))
		}
		catalog[id] = Ornament{ID: id, Kind: kind, Acquisition: acquisition}
	}
	return catalog
}

func sortedCatalogIDs() []OrnamentID {
	ids := make([]OrnamentID, 0, len(ornamentCatalog))
	for id := range ornamentCatalog {
		ids = append(ids, id)
	}
	// Sorted so a catalog read has one stable order without a hand-kept second list beside the map.
	slices.Sort(ids)
	return ids
}

// kindOf reads a kind off an id's prefix. Unknown prefixes are refused rather than guessed, so a
// retired or hand-typed id cannot be answered as some other kind.
func kindOf(id OrnamentID) (OrnamentKind, bool) {
	for _, kind := range ornamentKinds {
		prefix := kindPrefix(kind)
		if len(id) > len(prefix) && strings.HasPrefix(string(id), prefix) {
			return kind, true
		}
	}
	return "", false
}

// AllOrnamentKinds is the DECLARED closed set, in read order. Exported because a drift guard has to
// compare against the declaration, not against the kinds the catalog happens to have rows for: a
// kind added to the enum with no row yet is exactly the case that would slip past a derived set and
// then push a counter key nothing knows.
func AllOrnamentKinds() []OrnamentKind {
	return slices.Clone(ornamentKinds)
}

// Ornaments is every published row, in the one stable order a catalog read answers in. It is the
// only way to enumerate the catalog from outside this package — the achievement pairing test and the
// panel's read both go through it, so nobody keeps a second list.
func Ornaments() []Ornament {
	rows := make([]Ornament, 0, len(catalogIDs))
	for _, id := range catalogIDs {
		rows = append(rows, ornamentCatalog[id])
	}
	return rows
}

// LookupOrnament resolves a catalog row. The second return is false for anything the catalog does
// not publish — a retired id, a typo, or an id from a client that invented one.
func LookupOrnament(id OrnamentID) (Ornament, bool) {
	ornament, ok := ornamentCatalog[id]
	return ornament, ok
}

// DefaultOrnamentID is the id a kind falls back to: its registry's own default. Absence of a
// selection row and an unknown or retired stored id both resolve here ([P10]).
func DefaultOrnamentID(kind OrnamentKind) (OrnamentID, bool) {
	id, ok := kindDefaults[kind]
	return id, ok
}

// PriceOf is the [P9] price rule: a purchasable row costs its kind's price, and everything else —
// every FREE row and every ACHIEVEMENT row — costs nothing. Resolved server-side, so no price table
// ever reaches a client.
func PriceOf(ornament Ornament) int {
	if ornament.Acquisition != AcquisitionPurchase {
		return 0
	}
	return kindPrices[ornament.Kind]
}

// RequirePurchasable is the catalog's judgement on a buy attempt, which is why an unbuyable row
// needs no price of ∞ and no `purchasable` column: an ACHIEVEMENT row is refused by the catalog
// itself ([P11]). A FREE row is refused the same way — it is already owned, so buying it is not a
// cheaper purchase but a meaningless one.
func RequirePurchasable(id OrnamentID) (Ornament, error) {
	ornament, ok := LookupOrnament(id)
	if !ok {
		return Ornament{}, fmt.Errorf("%w: %s", ErrUnknownOrnamentID, id)
	}
	if ornament.Acquisition != AcquisitionPurchase {
		return Ornament{}, fmt.Errorf("%w: %s", ErrOrnamentNotPurchasable, id)
	}
	return ornament, nil
}
