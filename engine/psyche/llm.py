"""Thin client over OpenAI-compatible endpoints (Meta Model API, open-weights hosts).

Every call is recorded with token usage and cost, so the dashboard can chart
tokens and dollars per chapter straight from real API responses.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from .config import Provider

T = TypeVar("T", bound=BaseModel)


class BudgetExceeded(RuntimeError):
    pass


@dataclass
class Budget:
    """In-process spend cap. Meta's spend limit only sends an email, so we stop ourselves."""

    limit_usd: float
    spent_usd: float = 0.0

    def check(self) -> None:
        if self.spent_usd >= self.limit_usd:
            raise BudgetExceeded(f"spent ${self.spent_usd:.4f} of ${self.limit_usd:.2f} budget")

    def add(self, usd: float) -> None:
        self.spent_usd += usd


@dataclass
class CallRecord:
    agent: str
    provider: str
    model: str
    prompt_tokens: int
    cached_tokens: int
    completion_tokens: int
    reasoning_tokens: int
    cost_usd: float
    latency_s: float
    tags: dict[str, Any] = field(default_factory=dict)
    ts: float = field(default_factory=time.time)


class Tracer:
    """Collects call records in memory and optionally appends them to a JSONL file."""

    def __init__(self, path: Path | None = None):
        self.path = path
        self.records: list[CallRecord] = []

    def log(self, record: CallRecord) -> None:
        self.records.append(record)
        if self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")


def strict_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Make a Pydantic JSON schema strict: every property required, no extra keys."""
    schema = json.loads(json.dumps(schema))

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" and "properties" in node:
                node["additionalProperties"] = False
                node["required"] = list(node["properties"])
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for item in node:
                visit(item)

    visit(schema)
    return schema


class LLM:
    def __init__(self, provider: Provider, budget: Budget, tracer: Tracer | None = None, client: Any = None):
        self.provider = provider
        self.budget = budget
        self.tracer = tracer or Tracer()
        # Long runs hit transient connection drops (seen on the open-weights host); retry with backoff.
        self.client = client or OpenAI(base_url=provider.base_url, api_key=provider.api_key, max_retries=6, timeout=300)

    def complete(
        self,
        *,
        agent: str,
        messages: list[dict[str, str]],
        reasoning_effort: str | None = None,
        max_tokens: int | None = None,
        response_format: dict[str, Any] | None = None,
        tags: dict[str, Any] | None = None,
    ) -> str:
        self.budget.check()
        kwargs: dict[str, Any] = {"model": self.provider.model, "messages": messages}
        if reasoning_effort and self.provider.supports_reasoning_effort:
            kwargs["reasoning_effort"] = reasoning_effort
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        if response_format:
            kwargs["response_format"] = response_format

        started = time.perf_counter()
        response = self.client.chat.completions.create(**kwargs)
        latency = time.perf_counter() - started

        self._record(agent, response.usage, latency, tags or {})
        return response.choices[0].message.content or ""

    def structured(
        self,
        *,
        agent: str,
        messages: list[dict[str, str]],
        schema: type[T],
        reasoning_effort: str | None = None,
        max_tokens: int | None = None,
        tags: dict[str, Any] | None = None,
        retries: int = 1,
    ) -> T:
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": schema.__name__,
                "schema": strict_schema(schema.model_json_schema()),
                "strict": True,
            },
        }
        last_error: Exception | None = None
        for _ in range(retries + 1):
            text = self.complete(
                agent=agent,
                messages=messages,
                reasoning_effort=reasoning_effort,
                max_tokens=max_tokens,
                response_format=response_format,
                tags=tags,
            )
            try:
                return schema.model_validate_json(text)
            except ValidationError as e:
                last_error = e
        raise ValueError(f"{agent}: model output did not match {schema.__name__}") from last_error

    def _record(self, agent: str, usage: Any, latency: float, tags: dict[str, Any]) -> None:
        prompt = getattr(usage, "prompt_tokens", 0) or 0
        completion = getattr(usage, "completion_tokens", 0) or 0
        prompt_details = getattr(usage, "prompt_tokens_details", None)
        completion_details = getattr(usage, "completion_tokens_details", None)
        cached = getattr(prompt_details, "cached_tokens", 0) or 0
        reasoning = getattr(completion_details, "reasoning_tokens", 0) or 0

        cost = self.provider.cost(prompt, cached, completion)
        self.budget.add(cost)
        self.tracer.log(
            CallRecord(
                agent=agent,
                provider=self.provider.name,
                model=self.provider.model,
                prompt_tokens=prompt,
                cached_tokens=cached,
                completion_tokens=completion,
                reasoning_tokens=reasoning,
                cost_usd=round(cost, 6),
                latency_s=round(latency, 3),
                tags=tags,
            )
        )
