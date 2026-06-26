package job

// clusterByUnionFind groups node ids into connected components over undirected links. The
// GROUPING (which ids share a component) is independent of link iteration order, but the chosen
// ROOT id is NOT — an equal-rank union keeps find(a), so it depends on which link came first.
// Callers that need an order-stable per-cluster key must derive it from the members (e.g. min id),
// not the root (redistribute is fine — a centroid is root-independent; spreadClusters uses min id).
func clusterByUnionFind(ids []string, links [][2]string) map[string]string {
	parent := make(map[string]string, len(ids))
	rank := make(map[string]int, len(ids))
	for _, id := range ids {
		parent[id] = id
	}
	var find func(string) string
	find = func(x string) string {
		p, ok := parent[x]
		if !ok {
			parent[x] = x
			return x
		}
		if p != x {
			parent[x] = find(p)
		}
		return parent[x]
	}
	union := func(a, b string) {
		ra, rb := find(a), find(b)
		if ra == rb {
			return
		}
		if rank[ra] < rank[rb] {
			ra, rb = rb, ra
		}
		parent[rb] = ra
		if rank[ra] == rank[rb] {
			rank[ra]++
		}
	}
	for _, l := range links {
		union(l[0], l[1])
	}
	out := make(map[string]string, len(ids))
	for _, id := range ids {
		out[id] = find(id)
	}
	return out
}
