import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import Card, Event

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
        event_type = "HELP_REQUESTED"
    elif action == "confused":
        event_type = "CONFUSED"
    else:
        return None, (jsonify({"error": "invalid action"}), 400)

    evt = Event(
        elder_id=elder_id,
        event_type=event_type,
        payload_json=json.dumps(
            {"card_id": card.id, "card_type": card.type},
            ensure_ascii=False
        ),
    )
    db.session.add(evt)
    db.session.commit()

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
    
    from app.models import VitalSign, Medication, ScheduleItem
    
    vitals = VitalSign.query.filter_by(elder_id=elder_id).order_by(VitalSign.recorded_at.desc()).limit(4).all()
    meds = Medication.query.filter_by(elder_id=elder_id).order_by(Medication.time.asc()).all()
    schedule = ScheduleItem.query.filter_by(elder_id=elder_id).order_by(ScheduleItem.time.asc()).all()
    
    # Optional helper: return fallback mock data if DB has none for this elder
    # But since we seed it for elder@test.com, we should just return whatever is in DB.
    
    return jsonify({
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
        ]
    })
