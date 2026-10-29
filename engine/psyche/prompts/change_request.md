You maintain the canon of facts for {company}. The warehouse manager has written a message about something that changed. Turn it into changes of existing facts.

Canon (every fact with its id, current value and statement):
<canon>
{canon}
</canon>

The manager's message:
<message>
{message}
</message>

Rules:
- Only change facts that the message clearly changes. Use the fact's id exactly as in the canon.
- new_value is the bare value in the fact's own unit and format (for example "8" for km/h, "26000" for kg). new_statement is the fact's statement rewritten with the new value and nothing else changed.
- Facts marked as computed are calculated in code from other facts. Never change them; change the facts they are computed from, and they will follow.
- If the message changes something the canon has no fact for, or is ambiguous (which zone? which truck type? from when?), do not guess. Put a short question for the manager in unclear.
- In reason, quote the words of the message that justify each change.
