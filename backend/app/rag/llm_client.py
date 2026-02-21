import os
from typing import List

from google import genai
from google.genai import types

from app.rag.retrieval import RetrievedDoc

SYSTEM_INSTRUCTION = """तपाईं एक नेपाली हेरचाहकर्ता सहायक हुनुहुन्छ।
तपाईंले उत्तर दिन 'CONTEXT (trusted caregiver notes)' भित्र भएको जानकारी मात्र प्रयोग गर्नुपर्छ।
CONTEXT मा नभएको कुरा अनुमान/थपेर नलेख्नुहोस्।
यदि CONTEXT पर्याप्त छैन भने: "म पक्का भन्न सक्दिनँ। परिवार/हेरचाहकर्तालाई सोधौँ?" भन्नुहोस्।
औषधि/स्वास्थ्यबारे CONTEXT बाहिरको चिकित्सकीय सल्लाह नदिनुहोस्।
टोन: न्यानो, सम्मानजनक ("हजुर"), छोटो र स्पष्ट।
"""

def _build_context(retrieved: List[RetrievedDoc]) -> str:
    chunks = []
    for i, d in enumerate(retrieved, start=1):
        chunks.append(f"[Doc {i}] title={d.title} type={d.doc_type}\n{d.content_nepali}")
    return "\n\n".join(chunks)

def gemini_answer(question_nepali: str, retrieved: List[RetrievedDoc]) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # you can choose: raise error, or safe fallback
        # raising is fine (your rag.py catches and falls back)
        raise RuntimeError("GEMINI_API_KEY not set")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    max_out = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "180"))
    temp = float(os.getenv("GEMINI_TEMPERATURE", "0.3"))

    client = genai.Client(api_key=api_key)

    context = _build_context(retrieved)
    prompt = (
        "CONTEXT (trusted caregiver notes):\n"
        f"{context}\n\n"
        "USER QUESTION:\n"
        f"{question_nepali}\n\n"
        "अब CONTEXT भित्रको आधारमा मात्र छोटो उत्तर दिनुहोस्।"
    )

    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=temp,
            max_output_tokens=max_out,
        ),
    )

    return (resp.text or "").strip()