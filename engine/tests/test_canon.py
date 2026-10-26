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
