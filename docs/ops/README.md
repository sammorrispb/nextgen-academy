# docs/ops/

Operational SOPs read by **cloud `/schedule` routines** (which git-clone this repo because they can't read Sam's local `~/Documents`). These are the **canonical** copies — the matching files under `~/Documents/NGA/06_operations/` are kept byte-identical as Sam's local working reference. Edit one, mirror the other.

- **`cadence_config.json`** — single source of truth for the NGA rolling session cadence (event weekends, skip/hold dates, venues, time slots, 3-2-0 lead offsets, live poll-Form URLs). Consumed by the "NGA Session Cadence" routine.
- **`Session_Cadence_Playbook.md`** — the poll → register → last-call SOP: model, dated calendar, weekly checklist, poll-Form spec, and the cadence routine prompt.
