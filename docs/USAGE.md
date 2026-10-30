# Using PsycheEngine

Every command runs from the repository root. Paths below use the Windows venv (`engine/.venv/Scripts/python`); on macOS/Linux use `engine/.venv/bin/python`. Costs are what the reported runs spent on `muse-spark-1.3` at standard prices.

## Setup

```bash
python -m venv engine/.venv
engine/.venv/Scripts/python -m pip install -e "engine[dev]"
cp .env.example .env
```

Settings in `.env`:

| variable | what it does |
|---|---|
| `MODEL_API_KEY` | Meta Model API key. Every agent uses it. |
| `META_MODEL` | Model for the agents, default `muse-spark-1.3`. `muse-spark-1.3-contributor` is far cheaper and was as good in our tests. |
| `CRITIC_PROVIDER` | `meta` (default) or `open`: run the critic on Muse Spark Open instead. The reported runs used `open`. |
| `AGENT_PROVIDER` | `open` runs every agent except the auditor on Muse Spark Open (runs `open-v1`, `open-v1y`). |
| `OPEN_WEIGHTS_BASE_URL`, `OPEN_WEIGHTS_API_KEY`, `OPEN_WEIGHTS_MODEL` | Where Muse Spark Open is hosted. Needed only with `CRITIC_PROVIDER=open` or `AGENT_PROVIDER=open`. |
| `PSYCHE_BUDGET_USD` | Spending cap per agent team in one process, default `5`. The command stops when it is reached; `--resume` (where available) continues later. Meta's own spend limit only sends an email. |

## Checks

| command | what it does | cost |
|---|---|---|
| `engine/.venv/Scripts/python -m pytest engine` | Offline tests of the canon, formulas, stale scan and agent plumbing. No model calls. | free |
| `engine/.venv/Scripts/python engine/scripts/smoke_test.py` | One real call to each configured provider: checks the key, structured output and token counts. | < $0.01 |

## Writing the documents

```bash
engine/.venv/Scripts/python engine/scripts/generate.py --run demo
```

Writes the four documents listed in `data/company/documents.json` (operations manual, safety instruction, job descriptions, SLA) from the facts in `data/company/company.json`. The planner plans each document, the writer writes each section with the whole canon in front of it, the critic rejects any section that disagrees with a fact, and the canon editor adds new facts a section introduced. About $2 for all four documents.

| option | meaning |
|---|---|
| `--run NAME` | Output folder `runs/NAME/`. Required. |
| `--docs ops,hs` | Only these documents (`ops`, `hs`, `roles`, `sla`). One document is the cheapest real test. |
| `--only-chapters N` | Only the first N chapters of each document. |
| `--words N` | Target words per section, default 450. |
| `--language X` | Language of the documents, default English. |
| `--resume` | Continue an interrupted run (lost connection, budget cap) in place. |

What lands in `runs/NAME/`:

| file | contents |
|---|---|
| `plan.json` | Planned sections and the facts each one uses. |
| `sections.json` | Accepted sections: text plus the facts they cite. |
| `canon/vNN.json` | Every version of the canon. |
| `events.jsonl` | What every agent did, including rejected drafts and the critic's quotes. |
| `calls.jsonl` | Tokens and cost of every model call. |

## Changing a fact

```bash
engine/.venv/Scripts/python engine/scripts/change_fact.py --run demo --fact F-LIM-01 --value 8 --statement "Forklifts must not exceed 8 km/h inside the building."
```

Changes one fact in a finished run. Facts computed from it are recalculated in code, only the sections that use any of them are rewritten (each rewrite goes past the critic), a code check makes sure no old value is left, and the client notice and staff memo are drafted. Results go to `runs/demo/changes/NN/`: `change.json` (the change), `diff.json` (sections before and after), `sections.json` (the documents afterwards) and `notices.json` (the two letters). Typically $0.10–0.40 per change.

`--fact` is a fact id from `data/company/company.json`, `--value` its new value and `--statement` the sentence the documents should now agree with.

```bash
engine/.venv/Scripts/python engine/scripts/notices.py --run demo
```

Drafts the notices again for every change already applied to a run, skipping the ones that already have them. Useful after an interruption.

### A change in plain words

```bash
engine/.venv/Scripts/python engine/scripts/request_change.py --run demo --message "We bought two more reach trucks, and the insurer now caps pallets at 850 kg."
```

The change agent maps the message to fact changes and prints them with the words that justify each one. Facts computed in code are never set directly, and anything ambiguous comes back as a question. Nothing changes until you type `y` (or pass `--yes`); then the changes go through the same propagation as `change_fact.py`, as one batch. The message and the agent's reading are saved in `changes/NN/request.json`. Around $0.30 for two changes.

## Taking over existing documents

```bash
engine/.venv/Scripts/python engine/scripts/adopt.py --run adopt-demo --source results/md-v2/baseline_separate --plan-dir results/md-v2 --audit results/md-v2/audit_baseline_separate.json
```

For a company that already has documents. The first run reads every section, builds a canon from it and writes the conflicts between passages to `runs/adopt-demo/questions.json` and an empty `answers.json`. Answer each with `a`, `b`, `ok` (not a real conflict) or the right rule in your own words, and run the same command again: each decision updates the canon, the affected sections are revised and checked by the critic, and a fresh audit counts what is left. `adopt.json` has the before/after counts. Without `--audit` the auditor reads the documents first. Under $1 for four documents on the contributor tier.

| option | meaning |
|---|---|
| `--source DIR` | Folder with the existing documents as `sections.json`. |
| `--plan-dir DIR` | Folder with the matching `plan.json` and `documents.json`. |
| `--audit FILE` | A saved audit of the source documents, instead of auditing them again. |

## Benchmarks

### Baselines and audit

```bash
engine/.venv/Scripts/python engine/scripts/benchmark.py baseline --run demo --variant separate
engine/.venv/Scripts/python engine/scripts/benchmark.py baseline --run demo --variant shared
engine/.venv/Scripts/python engine/scripts/benchmark.py audit --run demo
```

`baseline` writes the same documents with plain Muse Spark from the owner's brief, reusing the run's plan so both versions have the same table of contents and length. `--variant separate` writes each document in its own session; `--variant shared` lets every document see the ones written before it. `--with-facts` also hands the baseline the structured fact list. Output: `runs/demo/baseline_<variant>/`.

`audit` sends PsycheEngine's documents and every baseline to an independent auditor. It counts contradictions inside one document and between documents, plus statements that break a fact, and every finding has to quote the text word for word. Output: `runs/demo/audit_<label>.json`.

### A series of changes

```bash
engine/.venv/Scripts/python engine/scripts/mutate.py --run demo-copy --mutations data/company/mutations_year.json --baseline shared --per-doc-baseline separate --audit
```

Applies a list of changes to a finished run, one after another, both through PsycheEngine and through the baselines, and after every change scans all documents for old values. The scan is code, not a model. Run it on a **copy** of a run folder: it changes the run in place and refuses to start if `changes/` already exists.

| option | meaning |
|---|---|
| `--mutations FILE` | `data/company/mutations.json` (5 changes, default) or `mutations_year.json` (12 months, May changes 7 facts at once). |
| `--baseline VARIANT` | Baseline that gets each change in one request with every document in context. Default `shared`. |
| `--per-doc-baseline VARIANT` | Also a second baseline that updates each document on its own. |
| `--audit` | Audit the final documents as well. |

Output: `mutation_benchmark.json` (stale values per step, sections rewritten, cost), `mutations_baseline_<variant>/NN.json` and `mutations_baseline_per_doc_<variant>/NN.json` (baseline documents after each step) and `changes/NN/` as above. The year scenario cost $3.29 for PsycheEngine and about $2.2–2.5 per baseline; raise `PSYCHE_BUDGET_USD` if a team would pass the cap.

```bash
engine/.venv/Scripts/python engine/scripts/rescore.py --run demo-copy --mutations data/company/mutations_year.json
```

Repeats the stale scan on the saved snapshots with the current patterns. No model calls.

### Other measurements

They live in `engine/scripts/`.

| command | what it does |
|---|---|
| `audit_recall.py --sections PATH` | Plants known contradictions in a set of sections and counts how many the auditor finds (10 of 10 in the reported test). |
| `critic_bench.py --run-dir results/md-v4 --cases 10` | Plants wrong values, zones and procedure numbers in accepted sections and counts what the critic catches on Muse Spark Open and on Muse Spark 1.3, plus false alarms on untouched sections. About $0.60. |
| `pilot_multidoc.py --manual PATH --out DIR` | The first pilot: separately written documents checked for contradictions between them. |

## Publishing results

Also in `engine/scripts/`, run with the venv's python.

| command | what it does |
|---|---|
| `export_web.py --run demo --label "my run"` | Copies a run into `web/public/runs/demo/` for the dashboard. `--baseline` picks which baseline it shows, `--max-versions` how many canon versions the slider keeps. |
| `collect_results.py` | Copies the runs behind the README numbers into `results/`. Hand-written `.md` files there are kept. |
| `plot_year.py` | Redraws `docs/year.svg` from `results/md-v4y/mutation_benchmark.json`. |

## Dashboard

```bash
cd web
npm install
npm run dev
```

The dashboard reads only the JSON files in `web/public/runs/`, so it never calls a model. `runs.json` there lists which runs appear in the run picker; `export_web.py` adds a run to it.

## Your own company

Everything about the warehouse lives in `data/company/`:

- `brief.md`: how the owner describes the site. The baselines get only this.
- `company.json`: the facts. A fact can have a `formula` (computed from other facts in code) and `refs` (other facts it quotes).
- `documents.json`: which documents to write and their chapters.
- `mutations.json`, `mutations_year.json`: change scenarios. Each entry has `fact`, `value`, `statement` and `notice`; an entry with a `facts` list (each item `fact`, `value`, `statement`) and one `notice` changes several facts at once.

Replace these files and the same commands write and maintain another company's documents.
