"""
Memory CRUD routes — caregiver only.
Supports all 6 memory types from the master spec.
"""
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from app.extensions import db
from app.models import (
    Memory, MemoryPerson, MemoryMedicine, MemoryRoutine,
    MemoryEvent, MemoryObject, MemoryReassurance
)

memory_bp = Blueprint("memory", __name__, url_prefix="/api/memory")


# ─────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────

def _is_caregiver():
    return (get_jwt() or {}).get("role") == "caregiver"

def _caller_id():
    return int(get_jwt_identity() or 0)


# ─────────────────────────────────────────
# Serialization
# ─────────────────────────────────────────

def _serialize(m: Memory) -> dict:
    base = {
        "id":          m.id,
        "elder_id":    m.elder_id,
        "type":        m.type,
        "title":       m.title,
        "description": m.description,
        "source":      m.source,
        "valid_from":  m.valid_from.isoformat()  if m.valid_from  else None,
        "valid_to":    m.valid_to.isoformat()    if m.valid_to    else None,
        "created_at":  m.created_at.isoformat(),
        "updated_at":  m.updated_at.isoformat(),
        "detail":      {},
    }

    ext_map = {
        "person":      (MemoryPerson,      ["name", "relationship", "photo_url", "phone"]),
        "medicine":    (MemoryMedicine,    ["name", "dosage", "reason", "voice_url"]),
        "routine":     (MemoryRoutine,     ["time_of_day", "description", "repeat_pattern"]),
        "event":       (MemoryEvent,       ["related_person", "message", "photo_url"]),
        "object":      (MemoryObject,      ["object_name", "usual_location", "photo_url"]),
        "reassurance": (MemoryReassurance, ["message", "voice_url", "trigger_keywords"]),
    }

    if m.type in ext_map:
        Model, fields = ext_map[m.type]
        ext = Model.query.filter_by(memory_id=m.id).first()
        if ext:
            base["detail"] = {f: getattr(ext, f, None) for f in fields}
            # Extra datetime fields for event
            if m.type == "event":
                base["detail"]["effective_from"] = ext.effective_from.isoformat() if ext.effective_from else None
                base["detail"]["effective_to"]   = ext.effective_to.isoformat()   if ext.effective_to   else None

    return base


def _parse_dt(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────

@memory_bp.get("/<int:elder_id>")
@jwt_required()
def list_memories(elder_id):
    mtype = request.args.get("type")
    q = db.session.query(Memory).filter_by(elder_id=elder_id)
    if mtype:
        q = q.filter_by(type=mtype)
    memories = q.order_by(Memory.created_at.desc()).all()
    return jsonify({"elder_id": elder_id, "memories": [_serialize(m) for m in memories]})


@memory_bp.post("")
@jwt_required()
def create_memory():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    data     = request.get_json(silent=True) or {}
    elder_id = data.get("elder_id")
    mtype    = (data.get("type") or "").strip().lower()
    title    = (data.get("title") or "").strip()
    detail   = data.get("detail", {})

    if not elder_id or not mtype or not title:
        return jsonify({"error": "elder_id, type, and title are required"}), 400

    valid_types = ("person", "medicine", "routine", "event", "object", "reassurance")
    if mtype not in valid_types:
        return jsonify({"error": f"type must be one of {valid_types}"}), 400

    m = Memory(
        elder_id    = int(elder_id),
        type        = mtype,
        title       = title,
        description = data.get("description"),
        source      = "caregiver",
        valid_from  = _parse_dt(data.get("valid_from")),
        valid_to    = _parse_dt(data.get("valid_to")),
        created_by  = _caller_id(),
    )
    db.session.add(m)
    db.session.flush()
    _create_ext(m, mtype, detail)
    db.session.commit()

    return jsonify({"ok": True, "memory_id": m.id, "memory": _serialize(m)}), 201


@memory_bp.put("/<int:memory_id>")
@jwt_required()
def update_memory(memory_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    m = db.session.get(Memory, memory_id)
    if not m:
        return jsonify({"error": "memory not found"}), 404

    data   = request.get_json(silent=True) or {}
    detail = data.get("detail", {})

    for field in ("title", "description"):
        if field in data:
            setattr(m, field, data[field])
    if "valid_from" in data: m.valid_from = _parse_dt(data["valid_from"])
    if "valid_to"   in data: m.valid_to   = _parse_dt(data["valid_to"])

    _update_ext(m, detail)
    db.session.commit()
    return jsonify({"ok": True, "memory": _serialize(m)})


@memory_bp.delete("/<int:memory_id>")
@jwt_required()
def delete_memory(memory_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    m = db.session.get(Memory, memory_id)
    if not m:
        return jsonify({"error": "memory not found"}), 404

    db.session.delete(m)
    db.session.commit()
    return jsonify({"ok": True})


# ─────────────────────────────────────────
# Extension helpers
# ─────────────────────────────────────────

def _create_ext(m: Memory, mtype: str, detail: dict):
    eid, mid = m.elder_id, m.id
    if mtype == "person":
        db.session.add(MemoryPerson(
            memory_id=mid, elder_id=eid,
            name=detail.get("name", m.title),
            relationship=detail.get("relationship"),
            photo_url=detail.get("photo_url"),
            phone=detail.get("phone"),
        ))
    elif mtype == "medicine":
        db.session.add(MemoryMedicine(
            memory_id=mid, elder_id=eid,
            name=detail.get("name", m.title),
            dosage=detail.get("dosage"),
            reason=detail.get("reason"),
            voice_url=detail.get("voice_url"),
        ))
    elif mtype == "routine":
        db.session.add(MemoryRoutine(
            memory_id=mid, elder_id=eid,
            time_of_day=detail.get("time_of_day"),
            description=detail.get("description"),
            repeat_pattern=detail.get("repeat_pattern", "daily"),
        ))
    elif mtype == "event":
        db.session.add(MemoryEvent(
            memory_id=mid, elder_id=eid,
            related_person=detail.get("related_person"),
            message=detail.get("message", ""),
            photo_url=detail.get("photo_url"),
            effective_from=_parse_dt(detail.get("effective_from")),
            effective_to=_parse_dt(detail.get("effective_to")),
        ))
    elif mtype == "object":
        db.session.add(MemoryObject(
            memory_id=mid, elder_id=eid,
            object_name=detail.get("object_name", m.title),
            usual_location=detail.get("usual_location"),
            photo_url=detail.get("photo_url"),
        ))
    elif mtype == "reassurance":
        db.session.add(MemoryReassurance(
            memory_id=mid, elder_id=eid,
            message=detail.get("message"),
            voice_url=detail.get("voice_url"),
            trigger_keywords=detail.get("trigger_keywords"),
        ))


def _update_ext(m: Memory, detail: dict):
    if not detail:
        return
    mtype = m.type
    MODELS = {
        "person":      (MemoryPerson,      ["name", "relationship", "photo_url", "phone"]),
        "medicine":    (MemoryMedicine,    ["name", "dosage", "reason", "voice_url"]),
        "routine":     (MemoryRoutine,     ["time_of_day", "description", "repeat_pattern"]),
        "event":       (MemoryEvent,       ["related_person", "message", "photo_url"]),
        "object":      (MemoryObject,      ["object_name", "usual_location", "photo_url"]),
        "reassurance": (MemoryReassurance, ["message", "voice_url", "trigger_keywords"]),
    }
    if mtype not in MODELS:
        return
    Model, fields = MODELS[mtype]
    ext = Model.query.filter_by(memory_id=m.id).first()
    if ext:
        for k in fields:
            if k in detail:
                setattr(ext, k, detail[k])
        if mtype == "event":
            if "effective_from" in detail: ext.effective_from = _parse_dt(detail["effective_from"])
            if "effective_to"   in detail: ext.effective_to   = _parse_dt(detail["effective_to"])
