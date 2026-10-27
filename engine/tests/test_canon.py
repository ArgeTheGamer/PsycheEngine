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
