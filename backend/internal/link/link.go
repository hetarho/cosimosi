// Package link owns the synapse (memory_links) graph. In spec 04 it is read-only:
// GetUniverse reads every link for a user. Reinforcement (weight increase) and
// decay land in specs 11 and 12. It returns memory.Synapse values so the memory
// service can compose a Universe without importing link (one-way dep: link → memory).
package link
