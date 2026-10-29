from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from psyche.config import Provider
from psyche.llm import LLM, Budget, BudgetExceeded, strict_schema

PROVIDER = Provider(
    name="test",
    base_url="http://unused",
    api_key="x",
    model="m",
    input_per_m=1.0,
    cached_input_per_m=0.1,
    output_per_m=4.0,
)


class FakeClient:
    """Mimics openai.OpenAI().chat.completions.create with canned replies."""

    def __init__(self, replies: list[str], prompt_tokens: int = 1000, cached: int = 0, completion: int = 500):
        self.replies = list(replies)
        self.calls: list[dict] = []
        self.usage = SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion,
            prompt_tokens_details=SimpleNamespace(cached_tokens=cached),
            completion_tokens_details=SimpleNamespace(reasoning_tokens=100),
        )
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(content=self.replies.pop(0))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=self.usage)


class Verdict(BaseModel):
    ok: bool
    reasons: list[str]


def test_cost_counts_cached_tokens_at_cached_price():
    assert PROVIDER.cost(prompt_tokens=1000, cached_tokens=400, completion_tokens=500) == pytest.approx(
        (600 * 1.0 + 400 * 0.1 + 500 * 4.0) / 1_000_000
    )


def test_complete_records_usage_and_spend():
    llm = LLM(PROVIDER, Budget(1.0), client=FakeClient(["hi"], cached=200))
    assert llm.complete(agent="writer", messages=[], tags={"chapter": 3}) == "hi"
    record = llm.tracer.records[0]
    assert (record.agent, record.cached_tokens, record.reasoning_tokens) == ("writer", 200, 100)
    assert record.tags == {"chapter": 3}
    assert llm.budget.spent_usd == pytest.approx(record.cost_usd)


def test_budget_blocks_calls_once_exhausted():
    llm = LLM(PROVIDER, Budget(0.001), client=FakeClient(["a", "b"]))
    llm.complete(agent="writer", messages=[])
    with pytest.raises(BudgetExceeded):
        llm.complete(agent="writer", messages=[])


def test_structured_retries_then_parses():
    client = FakeClient(["not json", '{"ok": true, "reasons": []}'])
    llm = LLM(PROVIDER, Budget(1.0), client=client)
    assert llm.structured(agent="critic", messages=[], schema=Verdict) == Verdict(ok=True, reasons=[])
    assert client.calls[0]["response_format"]["json_schema"]["name"] == "Verdict"


def test_reasoning_effort_skipped_for_providers_without_it():
    client = FakeClient(["x"])
    no_effort = Provider(**{**PROVIDER.__dict__, "supports_reasoning_effort": False})
    LLM(no_effort, Budget(1.0), client=client).complete(agent="critic", messages=[], reasoning_effort="high")
    assert "reasoning_effort" not in client.calls[0]


def test_strict_schema_requires_all_properties_and_forbids_extras():
    schema = strict_schema(Verdict.model_json_schema())
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["ok", "reasons"]


def test_open_critic_without_host_settings_fails_loudly(monkeypatch):
    from psyche.config import provider_for

    monkeypatch.setenv("CRITIC_PROVIDER", "open")
    monkeypatch.setenv("OPEN_WEIGHTS_BASE_URL", "")
    with pytest.raises(RuntimeError, match="OPEN_WEIGHTS_BASE_URL"):
        provider_for("critic")
    assert provider_for("writer").name == "meta"


def test_agent_provider_open_moves_every_agent_but_the_auditor(monkeypatch):
    from psyche.config import provider_for

    monkeypatch.setenv("AGENT_PROVIDER", "open")
    monkeypatch.setenv("OPEN_WEIGHTS_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("OPEN_WEIGHTS_API_KEY", "test")
    assert {provider_for(a).name for a in ("planner", "writer", "critic", "canon_editor", "baseline")} == {"open"}
    assert provider_for("auditor").name == "meta"
