# Live run from the demo video

Recorded 2026-11-03 with:

```
engine\.venv\Scripts\python engine\scripts\demo_live.py --message "Our haulier switched to new trailers that carry 28,000 kg."
```

Source run: `results/md-v4y` (the published year). Writer and change agent: `muse-spark-1.3` (Meta API). Critic: Muse Spark Open.

| file | what it holds |
|---|---|
| `calls_live_demo.jsonl` | all 16 model calls: agent, model, tokens, cost, latency |
| `critic_check.json` | step 1: the planted 8 → 10 km/h and the critic's rejection |
| `changes/13/request.json` | step 2: the manager's message and the change agent's reading |
| `changes/13/change.json`, `events.jsonl` | step 3: the canon change, critic verdicts, stale scans |
| `changes/13/diff.json`, `notices.json`, `sections.json` | step 4: before/after of the 5 sections, both notices, all sections after |
| `canon_after.json` | canon v276 after the change |

The video speeds up step 3 (×3, then ×4); the timestamps in `calls_live_demo.jsonl` are the real ones.
