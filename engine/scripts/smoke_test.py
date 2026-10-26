"""One real call to each configured provider: checks the key, structured output and usage fields.

Run from the repo root:  engine/.venv/Scripts/python engine/scripts/smoke_test.py
Costs well under one cent per provider.
"""

from __future__ import annotations

import sys

from pydantic import BaseModel

from psyche.config import budget_usd, meta_provider, open_weights_provider
from psyche.llm import LLM, Budget


class Fact(BaseModel):
    name: str
    value: str
    unit: str


PROMPT = [
    {"role": "system", "content": "Extract the single fact from the text."},
    {"role": "user", "content": "Forklifts in the warehouse may not exceed 10 km/h."},
]


def check(llm: LLM) -> None:
    fact = llm.structured(agent="smoke", messages=PROMPT, schema=Fact, reasoning_effort="minimal", max_tokens=2000)
    r = llm.tracer.records[-1]
    print(f"[{llm.provider.name}] {llm.provider.model}: {fact.model_dump()}")
    print(
        f"  tokens in={r.prompt_tokens} cached={r.cached_tokens} out={r.completion_tokens} "
        f"reasoning={r.reasoning_tokens}  cost=${r.cost_usd:.6f}  {r.latency_s}s"
    )


def main() -> int:
    budget = Budget(budget_usd())
    providers = [meta_provider()]
    open_ = open_weights_provider()
    if open_.base_url and open_.api_key:
        providers.append(open_)
    else:
        print("[open] skipped: OPEN_WEIGHTS_BASE_URL / OPEN_WEIGHTS_API_KEY not set")

    failed = False
    for provider in providers:
        if not provider.api_key:
            print(f"[{provider.name}] skipped: no API key in .env")
            failed = True
            continue
        try:
            check(LLM(provider, budget))
        except Exception as e:  # report every provider, then fail
            print(f"[{provider.name}] FAILED: {type(e).__name__}: {e}")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
