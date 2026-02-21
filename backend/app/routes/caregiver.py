import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from app.models import Card, Event

from app.extensions import db
from app.models import KnowledgeDoc
from app.rag.embeddings import embed_text

caregiver_bp = Blueprint("caregiver", __name__, url_prefix="/api/caregiver")

def _is_caregiver():
    claims = get_jwt() or {}
    return claims.get("role") == "caregiver"

@caregiver_bp.post("/cards")
@jwt_required()
def create_card():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    data = request.get_json(silent=True) or {}

    elder_id_raw = data.get("elder_id")
    card_type = data.get("type", "MED")
    title_nepali = data.get("title_nepali")
    body_nepali = data.get("body_nepali")
    media_url = data.get("media_url")  # pill image path/url
    payload = data.get("payload")      # dict -> stored as JSON

    if not elder_id_raw or not title_nepali or not body_nepali:
        return jsonify({"error": "elder_id, title_nepali, body_nepali are required"}), 400

    try:
        elder_id = int(elder_id_raw) # type: ignore
    except (TypeError, ValueError):
        return jsonify({"error": "invalid elder_id"}), 400

    payload_json = None
    if isinstance(payload, dict):
        payload_json = json.dumps(payload, ensure_ascii=False)

    card = Card(
        elder_id=elder_id,
        type=str(card_type),
        title_nepali=str(title_nepali),
        body_nepali=str(body_nepali),
        media_url=media_url,
        payload_json=payload_json,
        status="active",
    )
    db.session.add(card)

    # optional: log that caregiver created a reminder
    evt = Event(
        elder_id=elder_id,
        event_type="CARD_CREATED",
        payload_json=json.dumps({"card_id": None, "type": card_type}, ensure_ascii=False),
    )
    db.session.add(evt)

    db.session.commit()

    return jsonify({"ok": True, "card_id": card.id})


@caregiver_bp.get("/dashboard")
@jwt_required()
def get_dashboard():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403
    
    from app.models import User, Event, Medication, Card, VitalSign
    from sqlalchemy import func
    
    elders_count = User.query.filter_by(role="elder").count()
    active_alerts = Event.query.filter_by(event_type="HELP_REQUESTED").count()
    meds_given = Medication.query.filter_by(taken=True).count()
    
    # Simple list of elders
    elders_list = []
    elders = User.query.filter_by(role="elder").all()
    for e in elders:
        elders_list.append({
            "id": e.id,
            "name": "Friend (Demo)" if "elder@test.com" in e.email else "Elder Test",
            "age": 78,
            "room": "A12",
            "status": "Stable",
            "score": 91,
            "med": "Due 2 pm",
            "last": "10 min ago"
        })
        
    activities = [
        {"color": "var(--success)", "text": "Medication given recently", "time": "10 min ago"},
        {"color": "var(--primary)", "text": "System health check complete", "time": "1 hr ago"}
    ]
    
    return jsonify({
        "stats": [
            {"icon": "👴", "label": "Elders Under Care", "value": str(elders_count), "change": "Stable", "dir": "up", "color": "var(--primary)", "bg": "var(--primary-subtle)"},
            {"icon": "🔔", "label": "Active Alerts", "value": str(active_alerts), "change": "Needs attention", "dir": "down", "color": "var(--danger)", "bg": "rgba(239,68,68,0.1)"},
            {"icon": "💊", "label": "Meds Administered", "value": str(meds_given), "change": "Tracking", "dir": "up", "color": "var(--primary)", "bg": "var(--primary-subtle)"},
            {"icon": "📊", "label": "Avg Health Score", "value": "87", "change": "Good", "dir": "up", "color": "var(--primary)", "bg": "var(--primary-subtle)"},
        ],
        "elders": elders_list,
        "activity": activities
    })
