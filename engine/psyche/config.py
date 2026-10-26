"""Model providers and runtime settings, read from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


@dataclass(frozen=True)
class Provider:
    """An OpenAI-compatible endpoint plus the prices we use for cost accounting (USD per 1M tokens)."""

    name: str
    base_url: str
    api_key: str
    model: str
    input_per_m: float
    cached_input_per_m: float
    output_per_m: float
    supports_reasoning_effort: bool = True

    def cost(self, prompt_tokens: int, cached_tokens: int, completion_tokens: int) -> float:
        uncached = prompt_tokens - cached_tokens
        return (
            uncached * self.input_per_m
            + cached_tokens * self.cached_input_per_m
            + completion_tokens * self.output_per_m
        ) / 1_000_000


def meta_provider() -> Provider:
    return Provider(
        name="meta",
        base_url="https://api.meta.ai/v1",
        api_key=os.environ.get("MODEL_API_KEY", ""),
        model=os.environ.get("META_MODEL", "muse-spark-1.3"),
        input_per_m=1.25,
        cached_input_per_m=0.15,
        output_per_m=4.25,
    )


def open_weights_provider() -> Provider:
    """Muse Spark Open on a third-party host (Baseten, Modal, Fireworks...). Launch pricing matches Muse Spark."""
    return Provider(
        name="open",
        base_url=os.environ.get("OPEN_WEIGHTS_BASE_URL", ""),
        api_key=os.environ.get("OPEN_WEIGHTS_API_KEY", ""),
        model=os.environ.get("OPEN_WEIGHTS_MODEL", "meta-models/muse-spark-open-1026"),
        input_per_m=1.25,
        cached_input_per_m=0.15,
        output_per_m=4.25,
        supports_reasoning_effort=False,
    )


def provider_for(agent: str) -> Provider:
    """Pick the provider for an agent; only the critic can be switched to open weights."""
    if agent == "critic" and os.environ.get("CRITIC_PROVIDER", "meta") == "open":
        provider = open_weights_provider()
        if not (provider.base_url and provider.api_key):
            raise RuntimeError("CRITIC_PROVIDER=open needs OPEN_WEIGHTS_BASE_URL and OPEN_WEIGHTS_API_KEY")
        return provider
    return meta_provider()


def budget_usd() -> float:
    return float(os.environ.get("PSYCHE_BUDGET_USD", "5"))
