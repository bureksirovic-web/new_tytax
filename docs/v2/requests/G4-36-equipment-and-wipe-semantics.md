# G4-36 — Equipment "not configured" semantics; a device-wipe repo method

**From:** G4 (settings) · **To:** G2 (repo), G1/G3 (pickers, swapper, builder) · **Date:** 2026-09-26

## 1. Equipment inventory "not configured"
**What:** `EquipmentInventory` (frozen) cannot tell "never configured" from "owns nothing":
`repo.equipment.get` returns an empty inventory in both cases.
**Settings' rule (implemented):** an inventory with *all four* lists empty (`stationIds`, `attachmentIds`,
`kettlebellsKg`, `bodyweightGear`) is **not configured** and Settings says "all exercises are shown";
"Show all exercises again" saves all four lists empty. Fixes legacy bug B13.
**Proposed change for consumers:** any exercise filtering by equipment (G1 catalog helpers, G3 picker /
swapper, programs builder) must treat that all-empty inventory as "no filtering".
Optional contract addition (additive): `EquipmentInventory.configuredAt?: string`.
Ids written: stations and attachments are the catalog's ids (`catalog.stations[].id`,
`catalog.attachments[].id`, e.g. `smith`, `rope`, `d-handle`); bodyweight gear uses `EquipmentRequirement`.

## 2. Device wipe
**What:** the danger-zone "Delete all data on this device" calls `repo.resetAll()`, which the contract
documents as "Test/e2e only".
**Proposed change:** either bless `resetAll()` for the user-facing wipe (doc comment change) or add
`wipeAll(): Promise<void>` with the same behaviour. Settings then clears only the app's localStorage keys
(prefixes `tytax`, `locale`, `theme`, `units`) and reloads; `AppBootstrap.ensureActive` recreates a profile.
**Local workaround:** uses `resetAll()` now.
