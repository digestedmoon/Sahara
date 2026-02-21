import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt

from app.extensions import db
from app.models import Event

events_bp = Blueprint("events", __name__, url_prefix="/api/caregiver")

def _is_caregiver():
    claims = get_jwt() or {}
    return claims.get("role") == "caregiver"

@events_bp.get("/events/<int:elder_id>")
@jwt_required()
def list_events(elder_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    # optional query params
    limit = request.args.get("limit", "50")
    try:
        limit = max(1, min(int(limit), 200))
    except ValueError:
        limit = 50

    events = (
        db.session.query(Event)
        .filter(Event.elder_id == elder_id)
        .order_by(Event.created_at.desc())
        .limit(limit)
        .all()
    )

    # Parse payload_json safely (it may be null or invalid JSON)
    def _parse_payload(s):
        if not s:
            return None
        try:
            return json.loads(s)
        except Exception:
            return s  # fallback: return raw string

    return jsonify({
        "elder_id": elder_id,
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "payload": _parse_payload(e.payload_json),
                "created_at": e.created_at.isoformat()
            }
            for e in events
        ]
    })