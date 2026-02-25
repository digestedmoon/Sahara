"""
Emergency system routes — no AI involved.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db, socketio
from app.models import EmergencyEvent, MemoryPerson, Memory

emergency_bp = Blueprint("emergency", __name__, url_prefix="/api/emergency")


@emergency_bp.post("")
@jwt_required()
def log_emergency():
    """Log an emergency event and notify caregivers via WebSocket."""
    data     = request.get_json(silent=True) or {}
    elder_id = int(get_jwt_identity() or data.get("elder_id") or 0)
    trigger  = data.get("trigger", "button")   # 'voice' | 'button' | 'confusion'

    # Fetch primary contact info to log who was called
    contacts_q = (
        db.session.query(MemoryPerson)
        .join(Memory, Memory.id == MemoryPerson.memory_id)
        .filter(Memory.elder_id == elder_id, Memory.type == "person")
        .order_by(Memory.created_at.asc())
        .first()
    )
    contact_info = None
    if contacts_q:
        contact_info = f"{contacts_q.name} ({contacts_q.phone})"

    evt = EmergencyEvent(
        elder_id       = elder_id,
        trigger        = trigger,
        contact_called = contact_info,
    )
    db.session.add(evt)
    db.session.commit()

    # Real-time push to caregiver dashboards
    from datetime import datetime
    socketio.emit("emergency", {
        "elder_id":    elder_id,
        "trigger":     trigger,
        "contact":     contact_info,
        "timestamp":   datetime.utcnow().isoformat(),
    })

    return jsonify({
        "ok":           True,
        "contact":      contact_info,
        "message":      "मद्दतको लागि सम्पर्क गरिँदैछ। (Contacting for help.)",
    })


@emergency_bp.get("/contacts/<int:elder_id>")
@jwt_required()
def get_contacts(elder_id):
    """Return all person memories (contacts) for an elder — used by elder UI for emergency calls."""
    persons = (
        db.session.query(MemoryPerson)
        .join(Memory, Memory.id == MemoryPerson.memory_id)
        .filter(Memory.elder_id == elder_id, Memory.type == "person")
        .order_by(Memory.created_at.asc())
        .all()
    )
    return jsonify({
        "elder_id": elder_id,
        "contacts": [
            {
                "name":         p.name,
                "relationship": p.relationship,
                "phone":        p.phone,
                "photo_url":    p.photo_url,
            }
            for p in persons
        ],
    })


@emergency_bp.get("/history/<int:elder_id>")
@jwt_required()
def get_history(elder_id):
    """Returns the 20 most recent emergency events for an elder."""
    events = (
        EmergencyEvent.query
        .filter_by(elder_id=elder_id)
        .order_by(EmergencyEvent.timestamp.desc())
        .limit(20)
        .all()
    )
    return jsonify({
        "elder_id": elder_id,
        "events": [
            {
                "id":             e.id,
                "trigger":        e.trigger,
                "contact_called": e.contact_called,
                "timestamp":      e.timestamp.isoformat(),
            }
            for e in events
        ],
    })
