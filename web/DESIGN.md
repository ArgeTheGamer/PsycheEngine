# Dashboard design system

The dashboard is a control room for warehouse paperwork, so its look comes from the warehouse floor, not from AI product pages. Reference implementation: `src/components/shell.tsx` and `src/components/production-view.tsx`.

## Palette (tokens in `src/app/globals.css`)

| token | hex | use |
|---|---|---|
| `concrete` | `#e4e6e3` | page background, like a concrete floor |
| `concrete-deep` | `#d3d6d2` | sidebar, selected rows |
| `label` | `#fbfbf9` | cards and reading surfaces, like label stock |
| `ink` | `#1b2330` | text, 1.5px borders, active tabs |
| `ink-soft` | `#4a5463` | secondary text |
| `rule` | `#b9beb8` | thin dividers inside a card |
| `hazard` | `#e8590c` | **only** out-of-date values and contradictions |
| `hazard-soft` | `#fde4d3` | background of a marked quote |
| `steady` | `#2f6f5e` | a count that is zero where problems are possible |

Rules: no gradients, no shadows, no rounded corners on cards or buttons. Borders are `1.5px` ink between regions and `1px` rule inside them. Hazard orange never decorates; if it is on screen, something is wrong in a document.

## Type

- `font-display`: Barlow Condensed, uppercase, 600/700, for headings, tab names and big numbers. Never for paragraphs.
- `font-sans`: IBM Plex Sans for reading text and UI copy.
- `font-mono`: IBM Plex Mono for ids, values and category tags.
- `.stencil`: the big floor-numeral counts (out-of-date values, contradictions). One or two per view.
- `LocLabel` (`shell.tsx`): section and fact ids drawn as rack-location labels, document code in the dark block.

## Layout

Left sidebar with the six tabs (Production, Benchmark, Year, Graph, Logs, Usage), top bar with the run, Year overview, Play run and the EN/PL switch. Views fill the remaining space in columns separated by ink rules; avoid floating cards on a background.

## Language

Every UI string goes through `useT()` from `src/lib/i18n.tsx` with an English and a Polish entry. Document text, quotes and agent messages stay as written.
