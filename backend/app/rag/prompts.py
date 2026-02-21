import re
from app.rag.retrieval import RetrievedDoc

POLICY_NAME = "context-only"
FALLBACK_NEPALI = "म पक्का भन्न सक्दिनँ। परिवारलाई फोन गरौं?"

def fallback_message() -> str:
    return FALLBACK_NEPALI

def _extract_field(content: str, key_prefix: str) -> str | None:
    pattern = rf"^{re.escape(key_prefix)}\s*[:：]\s*(.+)$"
    for line in (content or "").splitlines():
        m = re.match(pattern, line.strip())
        if m:
            return m.group(1).strip()
    return None

def build_conversational_answer(retrieved: list[RetrievedDoc]) -> str:
    if not retrieved:
        return fallback_message()

    top = retrieved[0]
    content = (top.content_nepali or "").strip()

    med = _extract_field(content, "औषधि")
    why = _extract_field(content, "किन")
    when = _extract_field(content, "कहिले")

    # Conversational, but only from stored fields
    lines = []
    if med:
        lines.append(f"हजुर 😊 **{med}** को बारेमा यो जानकारी छ।")
    else:
        lines.append("हजुर 😊 यो जानकारी भेटियो।")

    if why:
        lines.append(f"**किन**: {why}")
    if when:
        lines.append(f"**कहिले**: {when}")

    # If not structured, return first 2–3 lines (still safe)
    if len(lines) <= 1:
        raw_lines = content.splitlines()
        short = "\n".join(raw_lines[:3]).strip()
        return short if short else fallback_message()

    return "\n".join(lines)