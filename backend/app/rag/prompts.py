import re
from app.rag.retrieval import RetrievedDoc

POLICY_NAME = "context-only"

# Softer default fallback (no phone every time)
FALLBACK_NEPALI_GENERAL = "म पक्का भन्न सक्दिनँ। कृपया अलि थप जानकारी दिनुहोस्, वा हेरचाहकर्तालाई सोधौँ?"
FALLBACK_NEPALI_URGENT = "हजुर—यो आपत्कालिन जस्तो देखिन्छ। कृपया तुरुन्त परिवार/हेरचाहकर्तालाई फोन गर्नुहोस्।"

# Keywords that imply urgency / emergency
_URGENT_HINTS = [
    "आपत", "इमरजेन्सी", "emergency",
    "छाती दुख", "सास फेर्न", "बेहोस", "रक्त", "कडा दुखाइ",
    "fall", "fell", "unconscious", "bleeding", "can't breathe",
]

def _is_urgent(text: str) -> bool:
    t = (text or "").lower()
    return any(k.lower() in t for k in _URGENT_HINTS)

def fallback_message(user_text: str = "") -> str:
    # Only mention phone if the question sounds urgent
    if _is_urgent(user_text):
        return FALLBACK_NEPALI_URGENT
    return FALLBACK_NEPALI_GENERAL


def _extract_field(content: str, key_prefix: str) -> str | None:
    pattern = rf"^{re.escape(key_prefix)}\s*[:：]\s*(.+)$"
    for line in (content or "").splitlines():
        m = re.match(pattern, line.strip())
        if m:
            return m.group(1).strip()
    return None


def build_conversational_answer(retrieved: list[RetrievedDoc], user_text: str = "") -> str:
    if not retrieved:
        return fallback_message(user_text)

    top = retrieved[0]
    content = (top.content_nepali or "").strip()

    med = _extract_field(content, "औषधि")
    why = _extract_field(content, "किन")
    when = _extract_field(content, "कहिले")

    lines: list[str] = []

    if med:
        lines.append(f"हजुर 😊 **{med}** को बारेमा यो जानकारी छ।")
    else:
        lines.append("हजुर 😊 यो जानकारी भेटियो।")

    if why:
        lines.append(f"**किन**: {why}")
    if when:
        lines.append(f"**कहिले**: {when}")

    # If not structured, return first 2–3 lines of stored note (still context-only)
    if len(lines) <= 1:
        raw_lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
        short = "\n".join(raw_lines[:3]).strip()
        return short if short else fallback_message(user_text)

    return "\n".join(lines)