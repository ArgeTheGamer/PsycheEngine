import json
from types import SimpleNamespace

from psyche import agents
from psyche.canon import Canon, CanonStore, Company, CompanySpec, Fact
from psyche.config import Provider
from psyche.engine import Settings, Team, run
from psyche.llm import LLM, Budget, Tracer

PROVIDER = Provider("test", "http://unused", "x", "fake-model", 1.0, 0.1, 4.0)

SPEED = Fact(id="F-LIM-01", category="limit", subject="forklift", attribute="max_speed_indoor", value="10",
             unit="km/h", statement="Forklifts must not exceed 10 km/h indoors.")
ZONE = Fact(id="F-ZON-01", category="zone", subject="zone_a", attribute="purpose", value="receiving",
            statement="Zone A is the receiving zone.")
CANON = Canon.from_spec(CompanySpec(company=Company(name="Harborwick", location="x", summary="x"), facts=[SPEED, ZONE]))

OUTLINE = {"chapters": [{"title": "Internal transport", "sections": [
    {"title": "Forklift speeds", "purpose": "speed rules", "fact_ids": ["F-LIM-01", "F-XXX-99"]}]}]}
BAD = {"text": "Drive at no more than 12 km/h inside the hall.", "cited_fact_ids": ["F-LIM-01"]}
GOOD = {"text": "Drive at no more than 10 km/h inside the hall. Unload in Zone A.", "cited_fact_ids": ["F-LIM-01"]}
REJECT = {"accepted": False, "issues": [{"category": "limit", "fact_id": "F-LIM-01",
          "quote": "no more than 12 km/h inside the hall", "problem": "Canon says 10 km/h."}]}
ACCEPT = {"accepted": True, "issues": []}
NEW = {"facts": [{"category": "limit", "subject": "forklift", "attribute": "horn_at_crossings", "value": "1",
                  "unit": "beep", "statement": "Sound the horn once at every crossing."}]}


class ScriptedClient:
    """Fake OpenAI client: replies by schema name, in order."""

    def __init__(self, script: dict[str, list[dict]]):
        self.script = {k: list(v) for k, v in script.items()}
        self.prompts: dict[str, list[str]] = {}
        usage = SimpleNamespace(prompt_tokens=100, completion_tokens=50, prompt_tokens_details=None,
                                completion_tokens_details=None)
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=lambda **kw: self._reply(kw, usage)))

    def _reply(self, kwargs, usage):
        name = kwargs["response_format"]["json_schema"]["name"]
        self.prompts.setdefault(name, []).append(kwargs["messages"][0]["content"])
        content = json.dumps(self.script[name].pop(0))
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))], usage=usage)


def make_team(client) -> Team:
    budget, tracer = Budget(1.0), Tracer()
    return Team(budget, tracer, make_llm=lambda agent: LLM(PROVIDER, budget, tracer, client=client))


def test_rejected_draft_is_rewritten_with_critic_feedback(tmp_path):
    client = ScriptedClient({"Outline": [OUTLINE], "Draft": [BAD, GOOD], "Verdict": [REJECT, ACCEPT], "NewFacts": [NEW]})
    [section] = run("brief", CANON, tmp_path, Settings(chapters=1), make_team(client))

    assert (section.id, section.attempts, section.unresolved_issues) == ("ch01.s1", 2, [])
    assert "no more than 12 km/h inside the hall" in client.prompts["Draft"][1]  # feedback reached the writer

    events = [json.loads(line) for line in (tmp_path / "events.jsonl").read_text().splitlines()]
    assert [e["kind"] for e in events] == ["plan", "draft", "verdict", "rewrite", "verdict", "canon_update"]
    assert events[2]["accepted"] is False and events[2]["quote"] == "no more than 12 km/h inside the hall"

    canon = CanonStore(tmp_path / "canon").latest()
    assert canon.sections_using("F-LIM-01") == ["ch01.s1"]
    assert canon.fact("F-LIM-02").source == "section:ch01.s1"  # new fact got the next free id
    assert canon.sections_using("F-LIM-02") == ["ch01.s1"]
    assert not canon.has("F-XXX-99")  # planner's invented id was dropped


def test_critic_issue_with_quote_not_in_text_is_ignored():
    hallucinated = {"accepted": False, "issues": [{**REJECT["issues"][0], "quote": "15 km/h on ramps"}]}
    llm = LLM(PROVIDER, Budget(1.0), client=ScriptedClient({"Verdict": [hallucinated]}))
    section = agents.Section(id="ch01.s1", chapter=1, chapter_title="T", title="S", purpose="p", fact_ids=[])
    assert agents.critique(llm, CANON, section, GOOD["text"]).accepted


def test_unresolved_section_is_kept_after_max_attempts(tmp_path):
    client = ScriptedClient({"Outline": [OUTLINE], "Draft": [BAD, BAD], "Verdict": [REJECT, REJECT],
                             "NewFacts": [{"facts": []}]})
    [section] = run("brief", CANON, tmp_path, Settings(chapters=1, max_attempts=2), make_team(client))
    assert section.attempts == 2
    assert section.unresolved_issues[0].fact_id == "F-LIM-01"
