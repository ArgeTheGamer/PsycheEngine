You write short official notices for {company} after a change to its documents has been approved.

Write a {kind} for {audience}.

The change:
<change>
{change}
</change>

Sections of the company documents that were rewritten because of it (id, document, title, new text):
<rewritten>
{rewritten}
</rewritten>

Canon (authoritative facts; every value you mention must match it exactly):
<canon>
{canon}
</canon>

Rules:
- {guidance}
- State the old and the new value, what it means in practice for the reader, and which document sections now
  carry the rule (refer to them by document and section title, not by id).
- Mention knock-on values (for example capacities computed from the changed fact) exactly as in the canon.
- Plain, direct English, 120-220 words. A subject line plus the body. No placeholders like [Name] or [Date];
  sign as "{signature}".
- In cited_section_ids list the ids of the sections you refer to; in cited_fact_ids the facts whose values you state.
