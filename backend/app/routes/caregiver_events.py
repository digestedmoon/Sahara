from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from app.extensions import db
from app.models import Event

caregiver_events_bp = Blueprint(
    "caregiver_events", __name__, url_prefix="/api/caregiver"
)

def _is_caregiver():
    claims = get_jwt() or {}
    return claims.get("role") == "caregiver"


@caregiver_events_bp.get("/events/<int:elder_id>")
@jwt_required()
def get_events(elder_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    events = (
        db.session.query(Event)
        .filter(Event.elder_id == elder_id)
        .order_by(Event.created_at.desc())
        .limit(50)
        .all()
    )

    return jsonify({
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "payload": e.payload_json,
                "created_at": e.created_at.isoformat()
            }
            for e in events
        ]
    })