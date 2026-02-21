import hashlib
import math
from typing import List

DEFAULT_DIM = 128

def embed_text(text: str, dim: int = DEFAULT_DIM) -> List[float]:
    text = (text or "").strip().lower()
    if not text:
        return [0.0] * dim

    digest = hashlib.sha256(text.encode("utf-8")).digest()

    vals = []
    seed = digest
    while len(vals) < dim:
        seed = hashlib.sha256(seed).digest()
        for b in seed:
            vals.append((b / 127.5) - 1.0)  # 0..255 -> -1..1
            if len(vals) >= dim:
                break

    norm = math.sqrt(sum(v * v for v in vals)) or 1.0
    return [v / norm for v in vals]