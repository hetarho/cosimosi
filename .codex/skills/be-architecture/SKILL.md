---
name: be-architecture
description: >-
  The backend placement gate — invoke BEFORE creating, moving, or naming ANY Go file under apps/api (a context
  package, handler, adapter, migration, query), and when reviewing whether backend code sits in the right place. Use
  when the user says "add an endpoint/RPC", "add a table/query", "where does this Go code go", "add a use-case", or
  during /implement-job for any BE surface. It carries the domain-first-Go decision procedure (composition root →
  context behavior → domain), the dependency rule, the proto/sql anti-corruption boundary, and a self-audit checklist.
  The authoritative rules live in spec/ARCHITECTURE.md §2 — this skill is the actionable procedure + audit, not a
  second copy. Read §2 first when a case is ambiguous.
---

# Backend architecture gate (domain-first Go)

**SSOT = [spec/ARCHITECTURE.md](../../../spec/ARCHITECTURE.md) §2** (§2.3 context layout, §2.4 dependency rule, §2.5
aggregate boundaries) + **§1** (the ubiquitous-language boundary). This skill gives the *procedure* + *audit*, not the
authoritative rules. If a placement is ambiguous, **open §2 and read it** — don't guess.

## When this fires
Before you create/move/rename **any** file under `apps/api` (context package, `rpc/`, `pg/`, migration, sqlc query,
`cmd/`, `platform/`), and whenever you review BE structure. `/implement-job` invokes this for every BE job.

## The decision procedure — where does this Go code go? (§2.3)

1. **Is it wiring** (build the server, inject concrete adapters, config)? → `cmd/api` or `cmd/worker` — the composition
   root, the only place that sees everything.
2. **Is it a domain type / value object / canonical name, or a pure domain function?** → the context package
   (`internal/<context>/types.go`, `service.go`) — or `internal/<context>/domain/` once the context earns the split.
   Pure, no IO, no proto/sqlc/pgx/JSON tags.
3. **Is it a use-case / consumer-owned port?** → context `service.go` / `ports.go` (or `app/` after the split). Ports
   are declared by the **consumer**, only once a consumer exists — no interfaces just for mocking.
4. **Is it persistence** (sqlc + thin pgx, row↔domain mapping)? → `internal/<context>/pg/`.
5. **Is it transport** (Connect handler, proto↔domain mapping)? → `internal/<context>/rpc/`. Keep it thin.
6. **Is it a 3rd-party service** (AI, etc.)? → a supporting wrapper context behind consumer-owned ports; the concrete
   adapter sits at the outermost ring.
7. **No business meaning** (config, db pool, rpc mux, id, generated values)? → `internal/platform/`.

**Start as one package per context; split (`domain/`·`app/`·`pg/`·`rpc/`) only when it earns it** — not as a starting
tax. Don't create empty packages to satisfy a diagram.

## The dependency rule (§2.4) — inward only
`rpc`/`pg`/SDK adapters → context behavior (or `app/`) → domain model (pure). The domain model knows **nothing** of
proto, sqlc rows, pgx, JSON/DB tags, or transport. Two anti-corruption mappers keep the language pure: the handler
(`proto↔domain`) and the pg adapter (`row↔domain`) — no proto/sql type ever leaks inward (§1). No ORM, no DI
framework, no generic repository over sqlc. Each context owns its tables; cross-context reads go through the owning
context's published behavior, never its tables.

## Aggregate boundaries (§2.5)
An entity with its own lifecycle is its own aggregate root; a shared entity is referenced **by id through a
membership/join**, never owned. Emergent relationships (computable from stored data) are **not** promoted to domain
types — materialize as an infra projection only if performance needs it, and only if rebuildable. Domain services are
**pure functions** (golden-parity with the FE/`packages/` mirror).

## Self-audit (run before you call the BE work done)
- [ ] The domain model imports no proto/sqlc/pgx/transport; product terms stay free of DB/JSON tags.
- [ ] Dependencies point inward; `rpc`/`pg` call context behavior, never the reverse.
- [ ] proto↔domain (handler) and row↔domain (pg) mappers exist at the edges; no foreign type leaks inward.
- [ ] Ports are consumer-declared and actually consumed (no mock-only interfaces).
- [ ] No new empty package just for shape; the split shape used only where it removes real noise.
- [ ] Canonical domain names match the ubiquitous language (§1) — no second product word for an existing concept
      (`pnpm lint:language`).
- [ ] Gates green: `docker run --rm -v ${PWD}/apps/api:/app -w /app golang:1.26 sh -c "go vet ./... && go build ./..."`.
