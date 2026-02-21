# app/rag/intent.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class IntentResult:
    name: str
    confidence: float
    reason: str

def detect_intent_nepali(text: str) -> Optional[IntentResult]:
    t = (text or "").strip().lower()

    # medicine reminder intent
    med_phrases = [
        "औषधि", "मेड", "medicine", "pills", "पिल", "गोली",
        "समय भयो", "समय", "खान", "खाने", "लिन", "लिने",
        "बिर्स", "बिर्सें", "बिर्सेँ", "भुलें", "भुलेँ",
    ]

    # help/call intent
    help_phrases = [
        "सहायता", "help", "फोन", "कल", "call",
        "सम्पर्क", "आफ्ना", "परिवार", "छोरा", "छोरी",
        "डाक्टर", "एम्बुलेन्स", "आपत", "आपतकाल"
    ]

    # simple scoring by keyword hits
    med_hits = sum(1 for p in med_phrases if p in t)
    help_hits = sum(1 for p in help_phrases if p in t)

    if med_hits >= 2 and med_hits >= help_hits:
        return IntentResult(name="MED_REMINDER", confidence=min(0.9, 0.2 * med_hits), reason=f"med_hits={med_hits}")

    if help_hits >= 2 and help_hits > med_hits:
        return IntentResult(name="HELP_CALL", confidence=min(0.9, 0.2 * help_hits), reason=f"help_hits={help_hits}")

    return None