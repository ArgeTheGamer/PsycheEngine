You maintain the company documents of {company}. Below are the owner's original description and the current
version of every document. The owner has just announced a change.

Update the documents so that they are correct after the change: fix every passage the change affects,
directly or through anything that depends on it. Do not touch passages the change does not affect.

Return only the sections you changed, each with its section id (exactly as in the headings) and its complete
new text. Return an empty list if nothing needs to change.

Company description from the owner (as originally written; the change below overrides it):
<brief>
{brief}
</brief>

Current documents:
<documents>
{documents}
</documents>

The change:
<change>
{notice}
</change>
