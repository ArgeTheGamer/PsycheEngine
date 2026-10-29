import pytest

from psyche.canon import Canon, CanonStore, Company, CompanySpec, Fact

COMPANY = Company(name="Test Logistics", location="Testville", summary="A test warehouse.")


def fact(id_: str, value: str = "10", **kw) -> Fact:
    defaults = dict(category="limit", subject="forklift", attribute="max_speed_indoor", unit="km/h",
                    statement=f"Forklifts must not exceed {value} km/h indoors.")
    return Fact(id=id_, value=value, **{**defaults, **kw})


@pytest.fixture
def canon() -> Canon:
    return Canon.from_spec(CompanySpec(company=COMPANY, facts=[fact("F-LIM-01"), fact("F-ZON-01", "A", category="zone")]))


def test_seed_rejects_duplicate_ids():
    with pytest.raises(ValueError, match="F-LIM-01"):
        Canon.from_spec(CompanySpec(company=COMPANY, facts=[fact("F-LIM-01"), fact("F-LIM-01")]))


def test_render_filters_and_formats(canon):
    assert canon.render(["F-LIM-01"]) == (
        "F-LIM-01 | forklift.max_speed_indoor = 10 km/h | Forklifts must not exceed 10 km/h indoors."
    )


def test_usage_bumps_version_and_replaces_previous_links(canon):
    v2 = canon.with_usage("ch04.s1", ["F-LIM-01", "F-ZON-01"])
    v3 = v2.with_usage("ch04.s1", ["F-LIM-01"])  # section rewritten, no longer cites the zone
    assert (canon.version, v2.version, v3.version) == (1, 2, 3)
    assert v3.usage == {"F-LIM-01": ["ch04.s1"]}
    assert canon.usage == {}  # earlier versions are untouched


def test_usage_rejects_unknown_facts(canon):
    with pytest.raises(KeyError, match="F-XXX-99"):
        canon.with_usage("ch01.s1", ["F-XXX-99"])


def test_new_facts_are_tagged_with_their_section(canon):
    v2 = canon.with_new_facts("ch07.s2", [fact("F-LIM-50", "1.5", attribute="aisle_width", unit="m")])
    assert v2.fact("F-LIM-50").source == "section:ch07.s2"
    with pytest.raises(ValueError):
        v2.with_new_facts("ch08.s1", [fact("F-LIM-50")])


def test_change_lists_every_dependent_section(canon):
    used = canon.with_usage("ch04.s1", ["F-LIM-01"]).with_usage("ch37.s2", ["F-LIM-01"])
    changed, change = used.with_change("F-LIM-01", "8", "Forklifts must not exceed 8 km/h indoors.")
    assert change.affected_sections == ["ch04.s1", "ch37.s2"]
    assert (change.old_value, changed.fact("F-LIM-01").value) == ("10", "8")
    assert used.fact("F-LIM-01").value == "10"


def test_store_round_trip_and_latest(tmp_path, canon):
    store = CanonStore(tmp_path / "canon")
    store.save(canon)
    store.save(canon.with_usage("ch01.s1", ["F-LIM-01"]))
    assert store.versions() == [1, 2]
    assert (tmp_path / "canon" / "v02.json").exists()
    assert store.latest().usage == {"F-LIM-01": ["ch01.s1"]}


def test_usage_ignores_repeated_citations(canon):
    v2 = canon.with_usage("ch04.s1", ["F-LIM-01", "F-LIM-01"])
    _, change = v2.with_change("F-LIM-01", "8", "Forklifts must not exceed 8 km/h indoors.")
    assert change.affected_sections == ["ch04.s1"]


def test_new_facts_reject_duplicates_within_batch(canon):
    with pytest.raises(ValueError, match="F-LIM-60"):
        canon.with_new_facts("ch07.s2", [fact("F-LIM-60"), fact("F-LIM-60", "2")])


def test_store_refuses_to_overwrite_history(tmp_path, canon):
    store = CanonStore(tmp_path)
    store.save(canon.with_usage("ch01.s1", ["F-LIM-01"]))
    store.save(canon.with_usage("ch01.s1", ["F-LIM-01"]))  # identical re-save is fine
    with pytest.raises(FileExistsError):
        store.save(canon.with_usage("ch02.s1", ["F-ZON-01"]))  # branching from v1 again would clobber v2


def test_derived_facts_recompute_and_propagate_to_dependent_sections():
    payload = fact("F-EQP-11", "24000", subject="trailer", attribute="payload", unit="kg", statement="Payload is 24000 kg.")
    pallet = fact("F-LIM-15", "1000", subject="pallet", attribute="max_gross_weight", unit="kg",
                  statement="A pallet weighs at most 1000 kg.")
    slots = fact("F-EQP-12", "33", subject="trailer", attribute="pallet_positions", unit="pallets", statement="33 slots.")
    full = fact("F-DRV-01", "0", subject="trailer", attribute="max_full_pallets", unit="pallets",
                statement="A trailer takes at most 0 full pallets.", formula="min(floor({F-EQP-11} / {F-LIM-15}), {F-EQP-12})")
    shift = fact("F-DRV-02", "0", subject="dispatch", attribute="max_pallets_per_shift", unit="pallets",
                 statement="Dispatch can load 0 pallets per shift.", formula="4 * {F-DRV-01} * 3")
    canon = Canon.from_spec(CompanySpec(company=COMPANY, facts=[payload, pallet, slots, full, shift]))
    assert (canon.fact("F-DRV-01").value, canon.fact("F-DRV-02").value) == ("24", "288")
    assert canon.fact("F-DRV-01").statement == "A trailer takes at most 24 full pallets."

    used = canon.with_usage("sla.ch02.s1", ["F-DRV-02"]).with_usage("ops.ch07.s2", ["F-LIM-15"])
    changed, change = used.with_change("F-LIM-15", "800", "A pallet weighs at most 800 kg.")
    assert changed.fact("F-DRV-01").value == "30" and changed.fact("F-DRV-02").value == "360"
    assert [(d.fact_id, d.old_value, d.new_value) for d in change.derived] == [("F-DRV-01", "24", "30"), ("F-DRV-02", "288", "360")]
    assert change.affected_sections == ["ops.ch07.s2", "sla.ch02.s1"]


def test_formula_rejects_anything_but_arithmetic():
    from psyche.canon import evaluate

    with pytest.raises(ValueError):
        evaluate("__import__('os').system('x')", {})


def test_facts_quoting_a_changed_value_are_updated_and_their_sections_affected():
    threshold = fact("F-LIM-14", "500", subject="write_off", attribute="threshold", unit="EUR", statement="Above 500 EUR.")
    rule = fact("F-RSP-02", "shift_supervisor", category="responsibility", subject="write_off", attribute="approver",
                unit="", statement="The shift supervisor approves write-offs up to 500 EUR.", refs=["F-LIM-14"])
    canon = Canon.from_spec(CompanySpec(company=COMPANY, facts=[threshold, rule])).with_usage("ops.ch02.s1", ["F-RSP-02"])
    changed, change = canon.with_change("F-LIM-14", "750", "Above 750 EUR.")
    assert changed.fact("F-RSP-02").statement == "The shift supervisor approves write-offs up to 750 EUR."
    assert change.quoting == ["F-RSP-02"] and change.affected_sections == ["ops.ch02.s1"]


def test_replace_number_only_touches_whole_numbers():
    from psyche.canon import replace_number

    assert replace_number("Up to 10 km/h, not 100 km/h.", "10", "8") == "Up to 8 km/h, not 100 km/h."
    assert replace_number("Payload 24,000 kg.", "24000", "22000") == "Payload 22000 kg."


def test_section_facts_quoting_a_company_value_follow_its_change():
    pallet = fact("F-LIM-15", "1000", subject="pallet", attribute="max_gross_weight", unit="kg", statement="Max 1000 kg.")
    ped = fact("F-LIM-03", "5", attribute="pedestrian", statement="5 km/h near people.")
    ramp = fact("F-LIM-04", "5", attribute="ramp", statement="5 km/h on ramps.")
    canon = Canon.from_spec(CompanySpec(company=COMPANY, facts=[pallet, ped, ramp]))
    rule = fact("F-RUL-05", "prohibited", category="rule", subject="pallet", attribute="split", unit="",
                statement="A 1,000 kg pallet must never be split; slow to 5 km/h when moving it.")
    canon = canon.with_new_facts("ops.ch07.s3", [rule]).with_usage("ops.ch07.s3", ["F-RUL-05"])
    assert canon.fact("F-RUL-05").refs == ["F-LIM-15"]  # 5 km/h is ambiguous, so not linked
    changed, change = canon.with_change("F-LIM-15", "800", "Max 800 kg.")
    assert changed.fact("F-RUL-05").statement == "A 800 kg pallet must never be split; slow to 5 km/h when moving it."
    assert change.affected_sections == ["ops.ch07.s3"]


def test_batch_change_merges_derived_values_and_sections():
    payload = fact("F-EQP-11", "24000", subject="trailer", attribute="payload", unit="kg", statement="24000 kg.")
    pallet = fact("F-LIM-15", "1000", subject="pallet", attribute="max", unit="kg", statement="1000 kg.")
    full = fact("F-DRV-01", "0", subject="trailer", attribute="full", unit="pallets", statement="0 pallets.",
                formula="floor({F-EQP-11} / {F-LIM-15})")
    canon = Canon.from_spec(CompanySpec(company=COMPANY, facts=[payload, pallet, full]))
    canon = canon.with_usage("ops.ch01.s1", ["F-EQP-11"]).with_usage("sla.ch01.s1", ["F-DRV-01"])
    changed, change = canon.with_changes([("F-EQP-11", "26000", "26000 kg."), ("F-LIM-15", "800", "800 kg.")])
    assert [(a.fact_id, a.old_value, a.new_value) for a in change.also] == [("F-LIM-15", "1000", "800")]
    assert [(d.fact_id, d.old_value, d.new_value) for d in change.derived] == [("F-DRV-01", "24", "32")]
    assert change.affected_sections == ["ops.ch01.s1", "sla.ch01.s1"]
    assert changed.fact("F-DRV-01").value == "32"


def test_stale_scan_understands_counts_and_units():
    from psyche.stale import value_pattern

    assert value_pattern("6", "trucks").search("We run 6 counterbalance forklift trucks.")
    assert not value_pattern("6", "trucks").search("We run 16 reach trucks.")
    assert value_pattern("4", "doors").search("the 4 outbound dock doors")
    assert value_pattern("2.5", "t").search("rated at 2.5 t")
    assert value_pattern("8", "°C").search("held at +2 to +8 °C")


def test_stale_patterns_do_not_cross_units_or_numbers():
    from psyche.stale import value_pattern

    assert not value_pattern("6", "trucks").search("6 dock doors serve all trucks")
    assert not value_pattern("100", "EUR").search("above EUR 1000")
    assert not value_pattern("5", "m").search("belts run at 5 m/s")
    assert value_pattern("12", "pallets").search("max 12 pallets per run")


def test_quoting_fact_rewrites_only_the_quoted_value():
    cap = fact("F-LIM-06", "12", subject="run", attribute="max", unit="pallets", statement="Max 12 pallets.")
    canon = Canon.from_spec(CompanySpec(company=COMPANY, facts=[cap]))
    rule = fact("F-SCH-50", "night", category="schedule", subject="shift", attribute="night", unit="",
                statement="Night shift is 12 hours, max 12 pallets per run.")
    canon = canon.with_new_facts("ops.ch01.s1", [rule])
    changed, _ = canon.with_change("F-LIM-06", "14", "Max 14 pallets.")
    assert changed.fact("F-SCH-50").statement == "Night shift is 12 hours, max 14 pallets per run."


def test_truck_counts_do_not_match_people():
    from psyche.stale import value_pattern

    assert not value_pattern("8", "trucks").search("The 8 forklift operators hold powered-truck authorisation.")
    assert value_pattern("8", "trucks").search("The fleet has 8 electric pallet jacks.")


def test_change_request_keeps_only_settable_facts():
    from psyche.agents import ChangeRequest, RequestedChange, interpret_request

    spec = CompanySpec(company=COMPANY, facts=[
        fact("F-LIM-01"), fact("F-CAP-01", "20", formula="{F-LIM-01} * 2", statement="Capacity is 20.")])
    canon = Canon.from_spec(spec)

    class Model:
        def structured(self, **_):
            return ChangeRequest(unclear=["which zone?"], changes=[
                RequestedChange(fact_id=i, new_value=v, new_statement="s", reason="r")
                for i, v in [("F-LIM-01", "8"), ("F-CAP-01", "16"), ("F-XXX-01", "1"), ("F-LIM-01", "10")]])

    request, refused = interpret_request(Model(), canon, "slower forklifts")
    assert [c.fact_id for c in request.changes] == ["F-LIM-01"]
    assert len(refused) == 3 and request.unclear == ["which zone?"]
