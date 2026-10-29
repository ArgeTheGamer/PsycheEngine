# Auditor spot check

20 reports drawn at random (seed 20261029) from the 24 the auditor made on runs md-v2, md-v3 and md-v4
(contradictions and fact violations, PsycheEngine and both baselines). For each one, read the quotes and mark
whether the auditor is right: **yes** (a real conflict), **no** (not a conflict) or **unsure**.

Checked by: _____ · date: _____ · result: __ of 20 correct

## 1. contradiction · role · md-v4 · baseline_separate
- `ops.ch11.s2`: "Electric pallet jacks, hand pallet jacks, stretch wrappers and the cardboard baler require instruction, not manager authorisation."
- `roles.ch03.s3`: "the 8 electric pallet jacks or the 12 hand pallet jacks without individual authorisation by the Warehouse Manager."
- auditor: One section states electric and hand pallet jacks need only instruction and explicitly not manager authorisation, while the other requires individual Warehouse Manager authorisation for the same equipment.
- correct? **____**

## 2. violation · role · md-v3 · baseline_separate
- `roles.ch02.s1`: "refer overtime, door changes and policy exceptions to the Shift Supervisor and Warehouse Manager"
- fact `F-RSP-06`: The dispatcher assigns dock doors and time slots to carriers.
- auditor: The fact says the dispatcher assigns dock doors and time slots to carriers, not the Shift Supervisor and Warehouse Manager.
- correct? **____**

## 3. violation · reference · md-v2 · baseline_shared
- `hs.ch03.s1`: "uses high-bay pallet racking with 2,400 pallet positions under PR-08."
- fact `F-PRC-08`: Procedure PR-08 is titled Stocktaking and cycle counts.
- auditor: The fact states that PR-08 is titled Stocktaking and cycle counts, not bulk storage or put-away.
- correct? **____**

## 4. contradiction · zone · md-v4 · baseline_separate
- `ops.ch04.s4`: "pick faces in Zone C are never supplied from Zone F."
- `ops.ch09.s2`: "operators place to Zone B, Zone E or Zone C feed only by task."
- auditor: One section forbids ever supplying Zone C pick faces from Zone F, while the other directs operators in Zone F to place restocked goods to Zone C feed.
- correct? **____**

## 5. contradiction · zone · md-v3 · baseline_separate
- `ops.ch07.s2`: "Unwrapped, part-wrapped, unstable or unlabelled pallets never enter Zone D."
- `sla.ch01.s3`: "Labelled packs are moved to Zone D dispatch staging, where pallets are wrapped on the semi-automatic stretch wrappers and staged for their assigned outbound door."
- auditor: One section forbids unwrapped pallets from entering Zone D while the other moves labelled packs into Zone D staging to be wrapped there.
- correct? **____**

## 6. contradiction · role · md-v4 · baseline_shared
- `hs.ch01.s3`: "No other role operates forklifts, reach trucks or electric pallet jacks."
- `roles.ch02.s1`: "They use hand pallet jacks and, where instructed, electric pallet jacks"
- auditor: Both cannot be true because one forbids any role except forklift operators from operating electric pallet jacks while the other assigns inbound operators to use them.
- correct? **____**

## 7. violation · reference · md-v2 · baseline_shared
- `roles.ch03.s3`: "Racking stays in use only with a documented safety inspection every month under PR-08."
- fact `F-PRC-08`: Procedure PR-08 is titled Stocktaking and cycle counts.
- auditor: Fact states PR-08 is titled Stocktaking and cycle counts, not racking safety inspection.
- correct? **____**

## 8. contradiction · zone · md-v2 · baseline_separate
- `ops.ch11.s1`: "Identified at document check in Zone A, they are transferred promptly to Zone F without booking as stock"
- `sla.ch03.s2`: "They are never taken to Zones A, B, C, D or E before inspection."
- auditor: One section says returns are in Zone A for document check while the other says returns are never taken to Zone A before inspection.
- correct? **____**

## 9. contradiction · zone · md-v4 · baseline_separate
- `ops.ch11.s1`: "They run on the 4.0 m main transport aisles and never enter the 3.0 m high-bay aisles for high lifting."
- `hs.ch01.s3`: "Counterbalance forklifts shall not be used for high-level put-away or retrieval in the high bays except where the maintenance technician and shift supervisor have expressly confirmed suitability"
- auditor: One section imposes an absolute ban on counterbalance forklifts entering high-bay aisles, while the other permits their use there when suitability is confirmed.
- correct? **____**

## 10. contradiction · step_order · md-v4 · baseline_separate
- `ops.ch06.s2`: "Only wrapped and labelled pallets enter Zone D."
- `sla.ch01.s2`: "(a) scanner-verified picking in Zone C, (b) labelling and transfer to Zone D, (c) wrapping, (d) staging by outbound door"
- auditor: One section requires pallets to be already wrapped before entering Zone D, while the other orders transfer to Zone D before wrapping.
- correct? **____**

## 11. violation · step_order · md-v2 · baseline_separate
- `ops.ch02.s2`: "check documents before unloading is completed"
- fact `F-ORD-01`: At receiving, the document check happens BEFORE unloading (PR-01).
- auditor: The fact requires the document check to happen before any unloading starts.
- correct? **____**

## 12. contradiction · step_order · md-v2 · baseline_separate
- `ops.ch02.s2`: "They unload at inbound Doors 1-4, check documents before unloading is completed"
- `ops.ch04.s1`: "Documents are checked first, before anything is unloaded, under PR-01 Inbound receiving."
- auditor: One section requires document check before any unloading starts while the other allows unloading to start before the check is completed.
- correct? **____**

## 13. contradiction · reference · md-v2 · baseline_separate
- `ops.ch10.s3`: "Racking safety is inspected separately from counting under PR-08."
- `roles.ch03.s3`: "The Maintenance Technician carries out the documented racking safety inspection every month under PR-10"
- auditor: The same monthly racking safety inspection is assigned to PR-08 in one section and to PR-10 in the other.
- correct? **____**

## 14. violation · zone · md-v3 · baseline_shared
- `ops.ch10.s1`: "and loading at docks 1-8."
- fact `F-ZON-11`: Dock doors 5-8 serve outbound dispatch.
- auditor: The fact states that only dock doors 5-8 serve outbound dispatch.
- correct? **____**

## 15. contradiction · zone · md-v2 · baseline_separate
- `ops.ch05.s3`: "If capacity is unavailable, booked pallets wait secured in Zone A and are carried in the handover."
- `hs.ch03.s2`: "Pallets awaiting put-away to the cage remain on the inbound trailer or on a marked holding position under supervision until cage space is confirmed."
- auditor: One section says hazmat awaiting cage space waits in Zone A while the other says it remains on the trailer or holding position.
- correct? **____**

## 16. violation · step_order · md-v3 · baseline_separate
- `hs.ch04.s3`: "inbound trucks unloaded and awaiting paperwork check"
- fact `F-ORD-01`: At receiving, the document check happens BEFORE unloading (PR-01).
- auditor: The fact requires the document check to happen before unloading.
- correct? **____**

## 17. contradiction · role · md-v2 · baseline_separate
- `ops.ch10.s1`: "Counting is done by staff assigned by the shift supervisor, checked by the stock controllers."
- `sla.ch02.s2`: "All cycle counts are performed by stock controllers, supported by trained floor staff under the shift supervisor in charge."
- auditor: One section makes floor staff responsible for counting with controllers checking, while the other makes controllers responsible with staff supporting.
- correct? **____**

## 18. contradiction · zone · md-v3 · baseline_separate
- `ops.ch09.s3`: "Hazardous quarantine stays inside the ventilated 60 m2 hazmat cage within its 4,000 kg limit and is never mixed with general quarantine."
- `hs.ch03.s3`: "They are never placed back in the hazmat cage, in Zone B racking, in Zone C pick faces, or in general waste or the cardboard baler."
- auditor: One section requires hazardous quarantine to stay inside the cage while the other forbids placing contaminated hazmat back in the cage.
- correct? **____**

## 19. contradiction · zone · md-v3 · baseline_separate
- `ops.ch09.s2`: "General ambient lines go to bulk storage in Zone B, chilled lines go to Zone E, and hazardous lines go only to the ventilated 60 m2 hazmat cage"
- `sla.ch03.s1`: "Restock from quarantine to Zone B, E or compliant Zone C locations is executed only after approval"
- auditor: One section limits restock to Zone B, Zone E and the hazmat cage while the other allows restock to compliant Zone C locations.
- correct? **____**

## 20. contradiction · limit · md-v4 · engine
- `ops.ch11.s2`: "A truck changing hands during the day does not require a second full documented check unless it has been tagged, repaired or involved in an incident"
- `hs.ch04.s3`: "Instruct replacement drivers to perform their own documented pre-use check each day even where the truck was already checked earlier on the same shift roster."
- auditor: One section says a truck changing hands does not need a second documented check, while the other requires a replacement driver to perform a new documented check even if already checked.
- correct? **____**
