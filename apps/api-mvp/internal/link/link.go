// Package link owns the synapse (memory_links) graph: listing links for a
// user's universe and reinforcing them idempotently by co-recall batch. It returns
// memory.Synapse values so the memory service can compose a Universe without
// importing link (one-way dep: link → memory).
package link
