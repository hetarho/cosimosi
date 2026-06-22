package job

import (
	"math"
	"time"

	"github.com/cosimosi/backend/internal/memory"
)

// excitability is e(c,t)=Σ exp(-Δt/tauExc) over a cluster's event timestamps (spec
// 22): member stars' last_recalled_at + incident synapses' last_activated_at.
func excitability(now time.Time, events []time.Time) float64 {
	tau := tauExc.Hours()
	var e float64
	for _, ev := range events {
		if ev.IsZero() {
			continue
		}
		dt := now.Sub(ev).Hours()
		if dt < 0 {
			dt = 0
		}
		e += math.Exp(-dt / tau)
	}
	return e
}

// deriveClusters groups candidate stars into connected components over existing synapses.
func deriveClusters(cands []Neighbor, links []ClusterLink) map[string]string {
	ids := make([]string, 0, len(cands))
	for _, c := range cands {
		ids = append(ids, c.MemoryID)
	}
	pairs := make([][2]string, 0, len(links))
	for _, l := range links {
		pairs = append(pairs, [2]string{l.AID, l.BID})
	}
	cluster := clusterByUnionFind(ids, pairs)
	out := make(map[string]string, len(cands))
	for _, c := range cands {
		out[c.MemoryID] = cluster[c.MemoryID]
	}
	return out
}

// clusterExcitability sums each cluster's recall and co-activation recency.
func clusterExcitability(now time.Time, clusterOf map[string]string, recalled map[string]time.Time, links []ClusterLink) map[string]float64 {
	events := make(map[string][]time.Time)
	for id, cl := range clusterOf {
		if t, ok := recalled[id]; ok {
			events[cl] = append(events[cl], t)
		}
	}
	for _, l := range links {
		cl, ok := clusterOf[l.AID]
		if !ok {
			cl, ok = clusterOf[l.BID]
		}
		if !ok {
			continue
		}
		events[cl] = append(events[cl], l.LastActivatedAt)
	}
	out := make(map[string]float64, len(events))
	for cl, evs := range events {
		out[cl] = excitability(now, evs)
	}
	return out
}

// biasedLinks re-ranks KNN candidates by competitive allocation (spec 22).
func biasedLinks(selfID, userID string, selfDate, now time.Time, cands []Neighbor, clusterOf map[string]string, clusterE map[string]float64, arousal float64) []LinkUpsert {
	_ = now
	pool := make([]Neighbor, 0, len(cands))
	for _, c := range cands {
		if c.MemoryID != selfID {
			pool = append(pool, c)
		}
	}
	var maxE float64
	for _, e := range clusterE {
		if e > maxE {
			maxE = e
		}
	}
	e := make(map[string]float64, len(clusterE))
	for k, v := range clusterE {
		e[k] = v
	}
	wExcGain := wExc * memory.ExcitabilityGain(arousal)
	score := func(n Neighbor) float64 {
		if maxE <= 0 {
			return n.CosSim
		}
		return n.CosSim + wExcGain*(e[clusterOf[n.MemoryID]]/maxE)
	}

	limit := biasedK
	if len(pool) < limit {
		limit = len(pool)
	}
	used := make([]bool, len(pool))
	out := make([]LinkUpsert, 0, limit)
	for len(out) < limit {
		best := -1
		var bestScore float64
		for i, c := range pool {
			if used[i] {
				continue
			}
			if s := score(c); best == -1 || s > bestScore {
				best, bestScore = i, s
			}
		}
		if best == -1 {
			break
		}
		used[best] = true
		n := pool[best]
		e[clusterOf[n.MemoryID]] *= inhibitDecay
		w := math.Min(initialWeight(n.CosSim, temporalBonus(selfDate, n.EntryDate)), semanticWeightCap)
		out = append(out, LinkUpsert{AID: selfID, BID: n.MemoryID, Weight: w, UserID: userID})
	}
	return out
}

func temporalBonus(self, other time.Time) float64 {
	days := math.Abs(self.Sub(other).Hours()) / 24.0
	if days >= temporalWindowDays {
		return 0
	}
	return temporalBonusMax * (1 - days/temporalWindowDays)
}

func initialWeight(cosSim, tBonus float64) float64 {
	return clamp(weightAlpha*cosSim+tBonus, 0, 1)
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
