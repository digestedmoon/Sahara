import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db, socketio
from app.models import Card, Event

from app.models import KnowledgeDoc
from app.rag.retrieval import retrieve_top_k, is_confident
from app.rag.llm_client import gemini_answer
from app.rag.prompts import fallback_message

elder_bp = Blueprint("elder", __name__, url_prefix="/api/elder")


# -----------------------------
# Helpers
# -----------------------------
def _elder_id_from_token():
    """
    Your login() creates JWT identity like:
      {"id": user.id, "role": user.role, "email": user.email}

    So we must read ident["id"] (not int(ident)).
    """
    ident = get_jwt_identity() or {}

    if isinstance(ident, dict):
        uid = ident.get("id")
        return int(uid) if uid else None

    # fallback for older tokens that might store just an int/string
    try:
        return int(ident)
    except Exception:
        return None


def _parse_payload(payload_str):
    if not payload_str:
        return None
    try:
        return json.loads(payload_str)
    except Exception:
        return payload_str  # fallback raw string


# -----------------------------
# Endpoints
# -----------------------------
@elder_bp.get("/cards")
@jwt_required()
def get_cards():
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401

    cards = (
        db.session.query(Card)
        .filter(Card.elder_id == elder_id, Card.status == "active")
        .order_by(Card.created_at.desc())
        .all()
    )

    return jsonify({
        "cards": [
            {
                "id": c.id,
                "type": c.type,
                "title_nepali": c.title_nepali,
                "body_nepali": c.body_nepali,
                "media_url": c.media_url,
                "payload": _parse_payload(c.payload_json),
                "status": c.status,
                "created_at": c.created_at.isoformat(),
            }
            for c in cards
        ]
    })


@elder_bp.get("/feed")
@jwt_required()
def get_feed():
    """
    Combined endpoint for the Elder Smart Display:
    - active_cards: what to show right now
    - latest_events: why/what happened recently (trigger + actions)
    """
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401

    # query params
    limit_events = request.args.get("events", "20")
    limit_cards = request.args.get("cards", "20")

    try:
        limit_events = max(1, min(int(limit_events), 200))
    except ValueError:
        limit_events = 20

    try:
        limit_cards = max(1, min(int(limit_cards), 200))
    except ValueError:
        limit_cards = 20

    cards = (
        db.session.query(Card)
        .filter(Card.elder_id == elder_id, Card.status == "active")
        .order_by(Card.created_at.desc())
        .limit(limit_cards)
        .all()
    )

    events = (
        db.session.query(Event)
        .filter(Event.elder_id == elder_id)
        .order_by(Event.created_at.desc())
        .limit(limit_events)
        .all()
    )

    return jsonify({
        "elder_id": elder_id,
        "active_cards": [
            {
                "id": c.id,
                "type": c.type,
                "title_nepali": c.title_nepali,
                "body_nepali": c.body_nepali,
                "media_url": c.media_url,
                "payload": _parse_payload(c.payload_json),
                "status": c.status,
                "created_at": c.created_at.isoformat(),
            }
            for c in cards
        ],
        "latest_events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "payload": _parse_payload(e.payload_json),
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    })


def _card_action(card_id: int, elder_id: int, action: str):
    card = (
        db.session.query(Card)
        .filter(Card.id == card_id, Card.elder_id == elder_id)
        .first()
    )
    if not card:
        return None, (jsonify({"error": "card not found"}), 404)

    if action == "ack":
        card.status = "ack"
        event_type = "CARD_ACK"
    elif action == "taken":
        card.status = "ack"
        event_type = "MED_TAKEN"
    elif action == "help":
        card.status = "help"  # ✅ makes HELP card disappear
        event_type = "HELP_REQUESTED"
    elif action == "confused":
        card.status = "confused"  # ✅ makes it disappear too (optional but recommended)
        event_type = "CONFUSED"
    else:
        return None, (jsonify({"error": "invalid action"}), 400)

    evt = Event(
        elder_id=elder_id,
        event_type=event_type,
        payload_json=json.dumps(
            {"card_id": card.id, "card_type": card.type, "text": f"Elder performed {action} on {card.type} card"},
            ensure_ascii=False
        ),
    )
    db.session.add(evt)
    db.session.commit()

    # Emit real-time event
    from datetime import datetime
    socketio.emit('new_event', {
        'elder_id': elder_id,
        'event_type': event_type,
        'text': f"Elder performed {action} on {card.type} card",
        'created_at': datetime.utcnow().isoformat()
    })

    return {"ok": True}, None


@elder_bp.post("/cards/<int:card_id>/taken")
@jwt_required()
def card_taken(card_id):
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401

    resp, err = _card_action(card_id, elder_id, "taken")
    return err or jsonify(resp)


@elder_bp.post("/cards/<int:card_id>/help")
@jwt_required()
def card_help(card_id):
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401

    resp, err = _card_action(card_id, elder_id, "help")
    return err or jsonify(resp)


@elder_bp.post("/cards/<int:card_id>/confused")
@jwt_required()
def card_confused(card_id):
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401

    resp, err = _card_action(card_id, elder_id, "confused")
    return err or jsonify(resp)


@elder_bp.get("/dashboard")
@jwt_required()
def get_dashboard():
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401
    
    from app.models import VitalSign, Medication, ScheduleItem, CareContact
    
    vitals = VitalSign.query.filter_by(elder_id=elder_id).order_by(VitalSign.recorded_at.desc()).limit(4).all()
    meds = Medication.query.filter_by(elder_id=elder_id).order_by(Medication.time.asc()).all()
    schedule = ScheduleItem.query.filter_by(elder_id=elder_id).order_by(ScheduleItem.time.asc()).all()
    contacts = CareContact.query.filter_by(elder_id=elder_id).order_by(CareContact.priority.asc()).all()
    
    # Optional helper: return fallback mock data if DB has none for this elder
    # But since we seed it for elder@test.com, we should just return whatever is in DB.
    
    return jsonify({"elder_id": elder_id,

        "vitals": [
            {
                "icon": v.icon, "label": v.label, "value": v.value, 
                "unit": v.unit, "status": v.status, "trend": v.trend,
                "color": "var(--primary)", "bg": "var(--primary-subtle)"
            } for v in vitals
        ],
        "medications": [
            {
                "name": m.name, "time": m.time, "taken": m.taken, "note": m.note
            } for m in meds
        ],
        "schedule": [
            {
                "time": s.time, "event": s.event, "icon": s.icon, "color": s.color or "var(--primary)"
            } for s in schedule
        ],
        "contacts": [
            {
                "id": c.id, "name": c.name, "relationship": c.relationship, "phone": c.phone
            } for c in contacts
        ]
    })

@elder_bp.get("/guidance")
@jwt_required()
def get_guidance():
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401

    # Import here to avoid circular imports
    from app.models import ScheduleItem, Medication, KnowledgeDoc
    from app.rag.retrieval import retrieve_top_k, is_confident
    from app.rag.llm_client import gemini_answer

    # 1) Quick deterministic “daily guidance” (fallback-safe)
    try:
        next_med = (
            Medication.query.filter_by(elder_id=elder_id, taken=False)
            .order_by(Medication.time.asc())
            .first()
        )
        next_schedule = (
            ScheduleItem.query.filter_by(elder_id=elder_id)
            .order_by(ScheduleItem.time.asc())
            .first()
        )
    except Exception:
        next_med = None
        next_schedule = None

    fallback_lines = ["हजुर 😊 आज आरामसँग बस्नुहोस्। पानी पिउनुहोस्।"]
    if next_med:
        fallback_lines.append(f"आजको दबाई बाँकी छ: {next_med.name} (समय: {next_med.time})")
    if next_schedule:
        fallback_lines.append(f"आजको काम: {next_schedule.event} (समय: {next_schedule.time})")

    fallback_text = "\n".join(fallback_lines)

    # 2) Try Gemini RAG guidance from caregiver notes (best experience)
    # You can store guidance notes as KnowledgeDocs (doc_type="GUIDANCE") or just general docs.
    try:
        question = "आजको लागि आमा/बुबालाई छोटो 'Gentle Guidance' दिनुहोस्।"
        retrieved, top_score = retrieve_top_k(
            db_session=db.session,
            KnowledgeDocModel=KnowledgeDoc,
            elder_id=int(elder_id),
            query_text=question,
            doc_type=None,   # or "GUIDANCE" if you use a specific type
            top_k=3,
        )

        if retrieved and is_confident(top_score):
            guidance = gemini_answer(question, retrieved)
            if guidance:
                return jsonify({
                    "elder_id": elder_id,
                    "guidance_nepali": guidance,
                    "mode": "rag_gemini",
                    "top_score": round(float(top_score), 4),
                })
    except Exception as e:
        # IMPORTANT: don't crash → return fallback
        print("GUIDANCE ERROR:", e)

    # 3) Final fallback (never fails)
    return jsonify({
        "elder_id": elder_id,
        "guidance_nepali": fallback_text,
        "mode": "fallback",
        "top_score": None,
    })

@elder_bp.post("/cards/<int:card_id>/ack")
@jwt_required()
def card_ack(card_id):
    elder_id = _elder_id_from_token()
    if not elder_id:
        return jsonify({"error": "elder login required"}), 401

    resp, err = _card_action(card_id, elder_id, "ack")
    return err or jsonify(resp)

