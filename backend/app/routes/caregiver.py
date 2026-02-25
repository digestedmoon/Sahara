"""
Caregiver dashboard route — overview stats, elder list, activity feed.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt

from app.extensions import db
from app.models import (
    User, Elder, CaregiverElderMap, Memory,
    Reminder, ReminderAction, InteractionLog, EmergencyEvent
)

caregiver_bp = Blueprint("caregiver", __name__, url_prefix="/api/caregiver")


def _is_caregiver():
    return (get_jwt() or {}).get("role") == "caregiver"


@caregiver_bp.get("/dashboard")
@jwt_required()
def dashboard():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    # Counts
    elder_count   = User.query.filter_by(role="elder").count()
    memory_count  = Memory.query.count()
    reminder_count = Reminder.query.filter_by(active=True).count()
    emergency_count = EmergencyEvent.query.count()

    # Compliance (taken / total)
    total_actions  = ReminderAction.query.count()
    taken_actions  = ReminderAction.query.filter_by(action="taken").count()
    compliance_pct = round(taken_actions / total_actions * 100, 1) if total_actions else 0

    # Elder list (join User + Elder)
    elders_list = []
    records = (
        db.session.query(User, Elder)
        .outerjoin(Elder, Elder.user_id == User.id)
        .filter(User.role == "elder")
        .all()
    )
    for user, elder in records:
        last_log = InteractionLog.query.filter_by(elder_id=user.id)\
            .order_by(InteractionLog.timestamp.desc()).first()
        last_active = last_log.timestamp.isoformat() if last_log else None

        mem_cnt = Memory.query.filter_by(elder_id=user.id).count()
        rem_cnt = Reminder.query.filter_by(elder_id=user.id, active=True).count()

        elders_list.append({
            "id":          user.id,
            "name":        getattr(elder, "name", user.email.split("@")[0].capitalize()),
            "email":       user.email,
            "language":    getattr(elder, "preferred_language", "ne"),
            "memories":    mem_cnt,
            "reminders":   rem_cnt,
            "last_active": last_active,
        })

    # Recent activity feed (last 10 interactions + emergencies)
    activity = []
    for log in InteractionLog.query.order_by(InteractionLog.timestamp.desc()).limit(8).all():
        activity.append({
            "type":      "query",
            "elder_id":  log.elder_id,
            "text":      log.raw_query or "",
            "intent":    log.intent,
            "timestamp": log.timestamp.isoformat(),
        })
    for ev in EmergencyEvent.query.order_by(EmergencyEvent.timestamp.desc()).limit(3).all():
        activity.append({
            "type":      "emergency",
            "elder_id":  ev.elder_id,
            "text":      f"Emergency: {ev.trigger}",
            "intent":    "emergency",
            "timestamp": ev.timestamp.isoformat(),
        })
    activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return jsonify({
        "stats": {
            "elder_count":    elder_count,
            "memory_count":   memory_count,
            "reminder_count": reminder_count,
            "emergency_count": emergency_count,
            "compliance_pct": compliance_pct,
        },
        "elders":   elders_list,
        "activity": activity[:10],
    })


@caregiver_bp.get("/elders")
@jwt_required()
def list_elders():
    """Return all elders (minimalist list for dropdown selectors)."""
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    records = (
        db.session.query(User, Elder)
        .outerjoin(Elder, Elder.user_id == User.id)
        .filter(User.role == "elder")
        .all()
    )
    return jsonify({
        "elders": [
            {
                "id":   u.id,
                "name": getattr(e, "name", u.email.split("@")[0].capitalize()),
                "email": u.email,
            }
            for u, e in records
        ]
    })
