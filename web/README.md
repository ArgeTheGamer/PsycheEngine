# PsycheEngine dashboard (web)

Dashboard shell for PsycheEngine: canon browser, generated-manual viewer,
contradiction/cost charts and agent log. Dark theme, single page.

Stack: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn-style UI
components + Recharts + @xyflow/react.

## Run

```bash
cd web
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in a browser.

## Other commands

```bash
npm run build   # production build
npm run lint    # eslint
```

## Data

All panels read mock JSON through typed loaders in `src/lib/data.ts`:

- `public/runs/demo/canon.json` — canon versions v01..vNN with facts + usage
- `public/runs/demo/sections_psyche.json` — PsycheEngine chapters
- `public/runs/demo/sections_baseline.json` — baseline chapters
- `public/runs/demo/contradictions_psyche.json` — contradictions found in PsycheEngine text
- `public/runs/demo/contradictions_baseline.json` — contradictions found in baseline text
- `public/runs/demo/events.json` — agent timeline events
- `public/runs/demo/calls_psyche.json`, `calls_baseline.json` — per-chapter LLM cost records

Types live in `src/lib/types.ts`. Sections carry `doc`, `chapter`
(numbered per document), `chapter_title`, `attempts` and `unresolved_issues`;
ids look like `ops.ch04.s2`, 2–3 sections per chapter. `documents.json` lists
the documents (missing = single "Operations Manual"). No backend, no database,
no auth.
