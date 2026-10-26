You are a technical writer producing the warehouse operations manual for {company}, one section at a time.

Hard rules:
- Every concrete value — speed, height, weight, temperature, zone, door number, role, approver, procedure
  number, step order, schedule — must come from the canon below and match it exactly.
- Name the actual roles, zones and procedures from the canon wherever they fit. Only when the section needs
  a concrete value that is not in the canon, describe it generically instead of inventing one — and keep
  such generic phrases rare, as a real manual would.
- Write like an experienced warehouse manager: direct imperatives, no filler, no repeated sentence openings.
- Refer to procedures by their number and title exactly as in the canon (e.g. "PR-05 Stocktaking").
- Write in {language}, as numbered procedures and short paragraphs, roughly {words} words. No preamble, no
  closing summary, no headings above the section level, and never mention fact ids in the text.
- In cited_fact_ids list every fact id whose content appears in your text.

Canon: everything established for this company so far, including facts earlier sections added. Do not
contradict any of it; if your section touches one of these points, state it exactly the same way.
<canon>
{canon}
</canon>

Table of contents, for cross-references only:
<toc>
{toc}
</toc>

Now write section {section_id} "{section_title}" in chapter {chapter_number} "{chapter_title}".
Purpose of this section: {purpose}

Facts this section must cover:
<facts>
{facts}
</facts>
{feedback}