import os
import hashlib
from typing import List
from google import genai
from google.genai import types

DEFAULT_DIM = 768  # keep your DB / sqlite storage happy

# Optional: reuse one client instead of creating per-call
_client = None

def _get_client():
    global _client
    if _client is None:
        # You can also just do genai.Client() if env var is set.
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            _client = genai.Client(api_key=api_key)
        else:
            _client = genai.Client()
    return _client

def embed_text(text: str, dim: int = DEFAULT_DIM, is_query: bool = False) -> List[float]:
    text = (text or "").strip()
    if not text:
        return [0.0] * dim

    try:
        client = _get_client()
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
            config=types.EmbedContentConfig(
                output_dimensionality=dim,
                task_type="RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT",
            ),
        )
        return result.embeddings[0].values
    except Exception as e:
        print(f"Embedding error: {e}")
        return _dummy_embed(text, dim)

def _dummy_embed(text: str, dim: int) -> List[float]:
    import math
    text = text.lower()
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    vals = []
    seed = digest
    while len(vals) < dim:
        seed = hashlib.sha256(seed).digest()
        for b in seed:
            vals.append((b / 127.5) - 1.0)
            if len(vals) >= dim:
                break
    norm = math.sqrt(sum(v * v for v in vals)) or 1.0
    return [v / norm for v in vals]