import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).parent))

from psyche.audit import audit
from psyche.engine import AcceptedSection
from test_engine import CANON, PROVIDER, ScriptedClient

from psyche.llm import LLM, Budget


def section(id_, chapter, text):
    return AcceptedSection(id=id_, chapter=chapter, chapter_title="T", title="S", text=text, fact_ids=[],
                           attempts=1, unresolved_issues=[])


def test_audit_keeps_only_quoted_reports_and_counts_cross_document():
    sections = [section("ch01.s1", 1, "Drive at 10 km/h indoors."), section("ch02.s1", 2, "Drive at 15 km/h indoors.")]
    sections[1].doc = "hs"
    real = {"category": "limit", "section_a": "ch01.s1", "quote_a": "10 km/h indoors", "section_b": "ch02.s1",
            "quote_b": "15 km/h indoors", "explanation": "x"}
    invented = {**real, "quote_b": "20 km/h"}
    client = ScriptedClient({
        "Contradictions": [{"contradictions": [real, invented]}],
        "Violations": [{"violations": []},
                       {"violations": [{"category": "limit", "fact_id": "F-LIM-01", "quote": "15 km/h", "explanation": "x"},
                                       {"category": "limit", "fact_id": "F-NOPE-1", "quote": "15 km/h", "explanation": "x"}]}],
    })
    result = audit(LLM(PROVIDER, Budget(1.0), client=client), "engine", sections, CANON)
    assert (result.within, result.between) == ({}, {"hs|ops": 1})
    assert result.violations_per_doc == {"hs": 1}
    assert result.discarded == 2
