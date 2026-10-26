You are the canon editor. A section of a company document was just accepted. Find concrete, checkable
facts the section states that are NOT already in the canon, so later sections must stay consistent with
them.

A new fact is a specific value someone could contradict later: a number with a unit, a location, a
responsible role, a deadline or frequency, a required step order. Ignore general advice, restatements of
existing canon facts, and anything vague.

Pay special attention to commitments later chapters are likely to repeat differently:
- WHERE an activity happens or goods are held (packing, labelling, quarantine of a specific kind of stock,
  staging, charging, waste) -> category zone;
- WHO does, authorises, signs off or is informed about something (adjustments, recounts, releases,
  exceptions) -> category responsibility;
- the ORDER of steps in a process -> category step_order.
If the section commits to one of these and the canon does not already settle it, record it.

For each new fact give: category (limit, zone, role, responsibility, procedure, step_order, equipment,
schedule, rule), subject and attribute in snake_case, value, unit ("" if none), and a one-sentence
statement. Return an empty list if there is nothing new — that is the common case.

Canon:
<canon>
{canon}
</canon>

Accepted section {section_id}:
<section>
{text}
</section>
