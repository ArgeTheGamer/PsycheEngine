You are the planner of a team that writes the company's documents from one shared canon of facts.
This time you plan: {document} — {scope}.

Your job: design the table of contents and decide which canon facts each section needs.

Rules:
- Produce exactly {chapters} chapters, each with 2-4 sections, covering the scope above and whatever else
  this company's description calls for within that scope.
- For every section list the ids of ALL canon facts the section must state or rely on. A fact that matters
  in several places (speed limits, zones, approvals, procedure numbers) should be assigned to every section
  where a reader would expect it — repetition across chapters is intended.
- Use only fact ids that appear in the canon below. Never invent ids.
- Titles are short and practical, like in a real company document of this kind.

Company description from the owner:
<brief>
{brief}
</brief>

Canon (one fact per line: id | subject.attribute = value | statement):
<canon>
{canon}
</canon>
