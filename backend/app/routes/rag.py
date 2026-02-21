import json
import os
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import KnowledgeDoc, Event, Card, CareContact
from app.rag.retrieval import retrieve_top_k, is_confident, TOP_SCORE_THRESHOLD
from app.rag.prompts import POLICY_NAME, fallback_message, build_conversational_answer
from app.rag.llm_client import gemini_answer
from app.rag.intent import detect_intent_nepali

rag_bp = Blueprint("rag", __name__, url_prefix="/api/rag")


# -----------------------------
# Helpers (grounded card content)
# -----------------------------
def _extract_first_line(prefix: str, text: str):
    for line in (text or "").splitlines():
        line = line.strip()
        if line.startswith(prefix):
            return line.split(":", 1)[1].strip() if ":" in line else line
    return None


def _build_med_card_from_docs(retrieved):
    top = retrieved[0]
    med_name = _extract_first_line("औषधि", top.content_nepali) or top.title
    when = _extract_first_line("कहिले", top.content_nepali)

    title = "औषधि सम्झना"
    if when:
        body = f"हजुर 😊 अब {med_name} लिनुहोस्।\nसमय: {when}"
    else:
        body = f"हजुर 😊 अब {med_name} लिनुहोस्।"

    payload = {
        "med_name": med_name,
        "time_hint": when,
        "source_doc_id": top.id,
        "source_doc_type": top.doc_type,
    }
    return title, body, payload


def _get_top_contact_for_elder(db_session, elder_id: int):
    return (
        db_session.query(CareContact)
        .filter(CareContact.elder_id == elder_id)
        .order_by(CareContact.priority.asc())
        .first()
    )


def _build_help_card_from_contact(contact):
    title = "सहायता"
    if contact:
        body = (
            f"हजुर 😊 सहायता चाहियो भने {contact.relationship} {contact.name} लाई फोन गर्नुहोस्।\n"
            f"फोन: {contact.phone}"
        )
        payload = {
            "name": contact.name,
            "relationship": contact.relationship,
            "phone": contact.phone,
            "priority": contact.priority,
        }
    else:
        body = "हजुर 😊 मलाई पक्का छैन। कृपया परिवार/हेरचाहकर्तालाई फोन गरौँ?"
        payload = None
    return title, body, payload


# -----------------------------
# Endpoint
# -----------------------------
@rag_bp.post("/query")
@jwt_required(optional=True)
def rag_query():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    doc_type = data.get("doc_type")
    elder_id = data.get("elder_id")

    if not text:
        return jsonify({"error": "text is required"}), 400

    # If elder_id not given, try from JWT identity
    ident = get_jwt_identity() or {}
    if elder_id is None and isinstance(ident, dict):
        elder_id = ident.get("id")

    if not elder_id:
        return jsonify({"error": "elder_id required (or login as elder)"}), 400

    retrieved, top_score = retrieve_top_k(
        db_session=db.session,
        KnowledgeDocModel=KnowledgeDoc,
        elder_id=int(elder_id),
        query_text=text,
        doc_type=doc_type,
        top_k=3,
    )

    confident = bool(retrieved) and is_confident(top_score)

    # -----------------------------
    # Not confident → fallback + log
    # -----------------------------
    if not confident:
        evt = Event(
            elder_id=int(elder_id),
            event_type="RAG_UNCERTAIN",
            payload_json=json.dumps(
                {
                    "text": text,
                    "doc_type": doc_type,
                    "top_score": round(top_score, 4),
                    "threshold": TOP_SCORE_THRESHOLD,
                },
                ensure_ascii=False,
            ),
        )
        db.session.add(evt)
        db.session.commit()

        return jsonify(
            {
                "answer_nepali": fallback_message(),
                "retrieved": [
                    {
                        "id": r.id,
                        "doc_type": r.doc_type,
                        "title": r.title,
                        "content_nepali": r.content_nepali,
                        "score": round(r.score, 4),
                    }
                    for r in retrieved
                ],
                "policy": POLICY_NAME,
                "confidence": {
                    "top_score": round(top_score, 4),
                    "threshold": TOP_SCORE_THRESHOLD,
                    "status": "uncertain",
                },
                "auto_card": {"created": False, "card_id": None},
            }
        )

    # -----------------------------
    # Confident → answer (Gemini or template)
    # -----------------------------
    try:
        answer = gemini_answer(text, retrieved)
        if not answer:
            answer = build_conversational_answer(retrieved)
    except Exception:
        answer = build_conversational_answer(retrieved)

    # -----------------------------
    # Auto-create card from intent (SAFE: only when confident)
    # -----------------------------
    created_card_id = None
    AUTO_CARDS = os.getenv("AUTO_CREATE_CARDS", "true").lower() in ("1", "true", "yes")

    if AUTO_CARDS:
        intent = detect_intent_nepali(text)
        if intent:
            try:
                if intent.name == "MED_REMINDER":
                    title, body, payload = _build_med_card_from_docs(retrieved)
                    card = Card(
                        elder_id=int(elder_id),
                        type="MED",
                        title_nepali=title,
                        body_nepali=body,
                        media_url=None,  # later: attach pill image
                        payload_json=json.dumps(payload, ensure_ascii=False),
                        status="active",
                    )
                    db.session.add(card)
                    db.session.flush()  # get card.id
                    created_card_id = card.id

                    db.session.add(
                        Event(
                            elder_id=int(elder_id),
                            event_type="AUTO_CARD_CREATED",
                            payload_json=json.dumps(
                                {"intent": intent.name, "card_id": created_card_id},
                                ensure_ascii=False,
                            ),
                        )
                    )

                elif intent.name == "HELP_CALL":
                    contact = _get_top_contact_for_elder(db.session, int(elder_id))
                    title, body, payload = _build_help_card_from_contact(contact)
                    card = Card(
                        elder_id=int(elder_id),
                        type="HELP",
                        title_nepali=title,
                        body_nepali=body,
                        media_url=None,
                        payload_json=json.dumps(payload, ensure_ascii=False) if payload else None,
                        status="active",
                    )
                    db.session.add(card)
                    db.session.flush()
                    created_card_id = card.id

                    db.session.add(
                        Event(
                            elder_id=int(elder_id),
                            event_type="AUTO_CARD_CREATED",
                            payload_json=json.dumps(
                                {"intent": intent.name, "card_id": created_card_id},
                                ensure_ascii=False,
                            ),
                        )
                    )

                db.session.commit()
            except Exception:
                db.session.rollback()
                created_card_id = None

    # -----------------------------
    # Response
    # -----------------------------
    return jsonify(
        {
            "answer_nepali": answer,
            "retrieved": [
                {
                    "id": r.id,
                    "doc_type": r.doc_type,
                    "title": r.title,
                    "content_nepali": r.content_nepali,
                    "score": round(r.score, 4),
                }
                for r in retrieved
            ],
            "policy": POLICY_NAME,
            "confidence": {
                "top_score": round(top_score, 4),
                "threshold": TOP_SCORE_THRESHOLD,
                "status": "confident",
            },
            "auto_card": {"created": bool(created_card_id), "card_id": created_card_id},
        }
    )