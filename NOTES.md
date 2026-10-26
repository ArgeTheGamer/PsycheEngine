# Build notes

One line per day: what works, what doesn't.

- **2026-10-26** — Kickoff day. Engine skeleton: OpenAI-compatible client for Meta Model API with per-call token/cost tracing and an in-code budget guard (Meta's spend limit is only an email alert). Unit tests pass. Live smoke test OK from Poland: `muse-spark-1.3` honours strict `json_schema` output and reports reasoning tokens (106 in / 205 out, $0.001, 2.6 s).
