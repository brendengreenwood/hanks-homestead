# Docs system

Three time horizons, three places. Every substantial change touches at least
the first two.

| Horizon | Where | What lives there |
|---|---|---|
| **Future** | [`BACKLOG.md`](../BACKLOG.md) (repo root) | Roadmap, epics, open questions |
| **Present** | [`docs/systems/`](systems/) | The **active state** of each system, as built. Always current — reading these should match the shipped game. |
| **Past** | [`docs/decisions/LOG.md`](decisions/LOG.md) | Append-only decision log: what was done, **why**, and what was rejected |
| (Superseded) | [`docs/archive/`](archive/) | Whole docs/plans that no longer describe reality, moved here with a stamp |

## The process

**When a feature or change ships:**
1. Update the relevant page(s) in `docs/systems/` so they describe the new
   reality. These pages are *state*, not history — no "we changed X to Y"
   narration, just Y.
2. Append an entry to `docs/decisions/LOG.md`: date, what changed, why, and
   any alternative that was considered and rejected. Entries are numbered
   (`D-NNN`) and **never edited or deleted** — if a decision is reversed,
   append a new entry that references the old one.

**When a doc stops describing reality** (a system is removed or rewritten
wholesale): don't delete it. Move it to `docs/archive/` and add a header:
`> ARCHIVED <date> — superseded by <link/reason>`. The archive is the
long-term memory; git history backs it up, but the archive keeps it findable.

**When planning something new:** it goes in `BACKLOG.md`, not here. When it
ships, it flows: backlog item checked → systems page updated → decision
logged.

## System pages

- [`systems/architecture.md`](systems/architecture.md) — code structure, state model, render loop
- [`systems/farm-loop.md`](systems/farm-loop.md) — seasons, growth, water/scorchers, feed, jobs
- [`systems/economy.md`](systems/economy.md) — crops, balance numbers, upgrades, tuning method
- [`systems/market.md`](systems/market.md) — price cycle, selling, elevator intake, contracts, storage/spoilage
- [`systems/interface.md`](systems/interface.md) — HUD, mobile layout, advisor/indicators/almanac, controls
- [`systems/presentation.md`](systems/presentation.md) — 3D scene, assets, animation, audio engine
