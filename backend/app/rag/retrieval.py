import json
import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

from app.rag.embeddings import embed_text

TOP_SCORE_THRESHOLD = 0.08
DEFAULT_TOP_K = 3

@dataclass
class RetrievedDoc:
    id: int
    doc_type: str
    title: str
    content_nepali: str
    score: float

def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)

def _parse_embedding(embedding_json: str) -> Optional[List[float]]:
    if not embedding_json:
        return None
    try:
        vec = json.loads(embedding_json)
        if isinstance(vec, list) and all(isinstance(x, (int, float)) for x in vec):
            return [float(x) for x in vec]
    except Exception:
        return None
    return None

def retrieve_top_k(
    *,
    db_session,
    KnowledgeDocModel,
    elder_id: int,
    query_text: str,
    doc_type: Optional[str] = None,
    top_k: int = DEFAULT_TOP_K,
) -> Tuple[List[RetrievedDoc], float]:
    q_vec = embed_text(query_text, is_query=True)


    q = db_session.query(KnowledgeDocModel).filter(KnowledgeDocModel.elder_id == elder_id)
    if doc_type:
        q = q.filter(KnowledgeDocModel.doc_type == doc_type)

    docs = q.all()

    scored: List[RetrievedDoc] = []
    for d in docs:
        d_vec = _parse_embedding(d.embedding_json)
        if not d_vec:
            continue
        score = _cosine(q_vec, d_vec)
        scored.append(RetrievedDoc(
            id=d.id,
            doc_type=d.doc_type,
            title=d.title,
            content_nepali=d.content_nepali,
            score=float(score),
        ))

    scored.sort(key=lambda x: x.score, reverse=True)
    top = scored[: max(1, top_k)]
    top_score = top[0].score if top else 0.0
    return top, top_score

def is_confident(top_score: float, threshold: float = TOP_SCORE_THRESHOLD) -> bool:
    return top_score >= threshold