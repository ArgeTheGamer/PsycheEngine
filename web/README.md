# PsycheEngine dashboard

The page the jury opens. It shows finished runs: the four documents side by side for PsycheEngine and the baseline, contradictions linked to the passage they conflict with, the year of changes month by month, the fact graph, replays of single changes, the agent log and the cost. It never calls a model. Everything comes from static JSON, so the deployed site costs nothing to look at.

Next.js 15 (App Router), TypeScript, Tailwind CSS 4, Recharts and React Flow. No backend, no database, no login. The look and its rules are in [DESIGN.md](DESIGN.md).

## Run it

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run build    # production build, what Vercel runs
npm run lint
```

## Data

`public/runs/runs.json` lists the runs in the run picker. Each run has a folder `public/runs/<run>/`, written by `engine/scripts/export_web.py` from a finished engine run:

| file | contents |
|---|---|
| `documents.json` | the documents and their codes (OPS, HS, ROLES, SLA) |
| `canon.json` | canon versions, each with its facts and the sections that use them |
| `sections_psyche.json`, `sections_baseline.json` | the text of both versions |
| `contradictions_*.json`, `audit_*.json` | what the auditor found, with quotes |
| `changes.json` | every fact change: rewritten sections, before/after, notices |
| `mutations.json` | the year scenario: out-of-date values per month for PsycheEngine and both baselines |
| `events.json` | what each agent did, rejected drafts included |
| `calls_*.json` | tokens and cost of every model call |

Loaders and types are in `src/lib/data.ts` and `src/lib/types.ts`. Section ids look like `ops.ch04.s2`. UI text goes through `useT()` in `src/lib/i18n.tsx`, which holds the English and Polish strings.
