"""
Reminders routes — caregiver creates, elder acknowledges.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from app.extensions import db
from app.models import Reminder, ReminderAction

reminders_bp = Blueprint("reminders", __name__, url_prefix="/api/reminders")


def _is_caregiver():
    return (get_jwt() or {}).get("role") == "caregiver"

def _caller_id():
    return int(get_jwt_identity() or 0)


def _serialize_reminder(r: Reminder) -> dict:
    return {
        "id":             r.id,
        "elder_id":       r.elder_id,
        "memory_id":      r.memory_id,
        "title":          r.title,
        "body":           r.body,
        "scheduled_time": r.scheduled_time,
        "repeat_pattern": r.repeat_pattern,
        "active":         r.active,
        "created_at":     r.created_at.isoformat(),
    }


@reminders_bp.get("/<int:elder_id>")
@jwt_required()
def list_reminders(elder_id):
    """Return all reminders for an elder."""
    active_only = request.args.get("active", "false").lower() == "true"
    q = Reminder.query.filter_by(elder_id=elder_id)
    if active_only:
        q = q.filter_by(active=True)
    reminders = q.order_by(Reminder.scheduled_time.asc()).all()
    return jsonify({"elder_id": elder_id, "reminders": [_serialize_reminder(r) for r in reminders]})


@reminders_bp.post("")
@jwt_required()
def create_reminder():
    """Caregiver creates a reminder."""
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    data = request.get_json(silent=True) or {}
    elder_id = data.get("elder_id")
    title    = (data.get("title") or "").strip()
    time_str = (data.get("scheduled_time") or "").strip()

    if not elder_id or not title or not time_str:
        return jsonify({"error": "elder_id, title, scheduled_time are required"}), 400

    r = Reminder(
        elder_id       = int(elder_id),
        memory_id      = data.get("memory_id"),
        title          = title,
        body           = data.get("body"),
        scheduled_time = time_str,
        repeat_pattern = data.get("repeat_pattern", "daily"),
        active         = True,
    )
    db.session.add(r)
    db.session.commit()
    return jsonify({"ok": True, "reminder_id": r.id, "reminder": _serialize_reminder(r)}), 201


@reminders_bp.put("/<int:reminder_id>")
@jwt_required()
def update_reminder(reminder_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    r = db.session.get(Reminder, reminder_id)
    if not r:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    for field in ("title", "body", "scheduled_time", "repeat_pattern", "active"):
        if field in data:
            setattr(r, field, data[field])

    db.session.commit()
    return jsonify({"ok": True, "reminder": _serialize_reminder(r)})


@reminders_bp.delete("/<int:reminder_id>")
@jwt_required()
def delete_reminder(reminder_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    r = db.session.get(Reminder, reminder_id)
    if not r:
        return jsonify({"error": "not found"}), 404

    db.session.delete(r)
    db.session.commit()
    return jsonify({"ok": True})


@reminders_bp.post("/<int:reminder_id>/action")
@jwt_required()
def reminder_action(reminder_id):
    """Elder logs their response to a reminder: taken / later / missed."""
    r = db.session.get(Reminder, reminder_id)
    if not r:
        return jsonify({"error": "reminder not found"}), 404

    data   = request.get_json(silent=True) or {}
    action = data.get("action", "")
    if action not in ("taken", "later", "missed"):
        return jsonify({"error": "action must be taken | later | missed"}), 400

    log = ReminderAction(
        reminder_id = reminder_id,
        elder_id    = r.elder_id,
        action      = action,
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({"ok": True, "action": action})


@reminders_bp.get("/<int:elder_id>/compliance")
@jwt_required()
def compliance(elder_id):
    """Return compliance stats for an elder's reminders."""
    actions = ReminderAction.query.filter_by(elder_id=elder_id).all()
    total  = len(actions)
    taken  = sum(1 for a in actions if a.action == "taken")
    later  = sum(1 for a in actions if a.action == "later")
    missed = sum(1 for a in actions if a.action == "missed")
    return jsonify({
        "elder_id":      elder_id,
        "total":         total,
        "taken":         taken,
        "later":         later,
        "missed":        missed,
        "compliance_pct": round(taken / total * 100, 1) if total else 0,
    })
