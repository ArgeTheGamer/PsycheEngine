# PsycheEngine

Multi-agent runtime for long documents that stay consistent from the first page to the last. Built on Muse Spark for the Meta Global AI Developer Hackathon 2026.

PsycheEngine writes a complete operations manual for a small warehouse and keeps every speed limit, zone, role and procedure number identical on page 4 and on page 60. It holds a versioned canon of company facts and checks every section against it before the section is accepted.

> Work in progress — results, benchmark and architecture diagram land here during the build week.

## Run locally

```bash
python -m venv engine/.venv
engine/.venv/Scripts/python -m pip install -e "engine[dev]"   # macOS/Linux: engine/.venv/bin/python
cp .env.example .env                                           # then add MODEL_API_KEY
engine/.venv/Scripts/python -m pytest engine                   # offline unit tests
engine/.venv/Scripts/python engine/scripts/smoke_test.py       # one real call per provider (< $0.01)
```

## Built during the hackathon

Everything in this repository was written during the build period (26 Oct – 4 Nov 2026). Daily progress is logged in [NOTES.md](NOTES.md) and in the commit history.

Coding tools: Claude Code and Muse Code.
