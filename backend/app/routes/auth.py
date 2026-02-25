from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models import (
    User, Elder, CaregiverElderMap,
    Memory, MemoryPerson, MemoryMedicine, MemoryRoutine,
    MemoryEvent, MemoryObject, MemoryReassurance,
    Reminder
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    data     = request.get_json(silent=True) or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or user.password != password:
        return jsonify({"error": "invalid credentials"}), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "email": user.email},
    )
    return jsonify({
        "access_token": token,
        "user": {
            "id":    str(user.id),
            "email": user.email,
            "role":  user.role,
            "name":  user.email.split("@")[0].capitalize(),
        },
    })


@auth_bp.post("/seed")
def seed():
    """
    Creates demo caregiver + elder accounts and populates one memory
    of each of the 6 types so the UI works immediately out of the box.
    Safe to call multiple times (idempotent).
    """
    # ── Users ───────────────────────────────────────────────
    cg_user = User.query.filter_by(email="caregiver@test.com").first()
    if not cg_user:
        cg_user = User(email="caregiver@test.com", password="pass", role="caregiver")
        db.session.add(cg_user)

    el_user = User.query.filter_by(email="elder@test.com").first()
    if not el_user:
        el_user = User(email="elder@test.com", password="pass", role="elder")
        db.session.add(el_user)

    db.session.flush()   # get IDs

    # ── Elder profile ────────────────────────────────────────
    elder = Elder.query.filter_by(user_id=el_user.id).first()
    if not elder:
        elder = Elder(
            user_id=el_user.id,
            name="Aama (Demo)",
            preferred_language="ne",
            timezone="Asia/Kathmandu",
        )
        db.session.add(elder)

    # ── Caregiver ↔ Elder mapping ────────────────────────────
    mapping = CaregiverElderMap.query.filter_by(
        caregiver_id=cg_user.id, elder_id=el_user.id
    ).first()
    if not mapping:
        mapping = CaregiverElderMap(
            caregiver_id=cg_user.id,
            elder_id=el_user.id,
            role="primary",
        )
        db.session.add(mapping)

    db.session.flush()

    eid = el_user.id   # elder user_id used as elder_id throughout

    # ── Helper: skip if memories of this type already exist ─
    def has_memory(mtype):
        return db.session.query(Memory).filter_by(elder_id=eid, type=mtype).first() is not None

    now = datetime.now(timezone.utc)

    # ── 1. Person memory ─────────────────────────────────────
    if not has_memory("person"):
        m = Memory(elder_id=eid, type="person",
                   title="छोरा राम (Son Ram)",
                   description="Elder's eldest son living in Kathmandu",
                   source="caregiver", created_by=cg_user.id)
        db.session.add(m); db.session.flush()
        db.session.add(MemoryPerson(
            memory_id=m.id, elder_id=eid,
            name="Ram Sharma", relationship="son",
            photo_url=None, phone="9800000001"
        ))

    # ── 2. Medicine memory ───────────────────────────────────
    if not has_memory("medicine"):
        m = Memory(elder_id=eid, type="medicine",
                   title="Metformin 500mg",
                   description="Blood sugar tablet", source="caregiver", created_by=cg_user.id)
        db.session.add(m); db.session.flush()
        db.session.add(MemoryMedicine(
            memory_id=m.id, elder_id=eid,
            name="Metformin 500mg", dosage="1 tablet",
            reason="रगतमा चिनी (blood sugar) नियन्त्रण गर्न लिने। खाना खाएपछि लिनुहोस्।",
            voice_url=None
        ))

    # ── 3. Routine memory ────────────────────────────────────
    if not has_memory("routine"):
        m = Memory(elder_id=eid, type="routine",
                   title="बिहानको दिनचर्या (Morning Routine)",
                   source="caregiver", created_by=cg_user.id)
        db.session.add(m); db.session.flush()
        db.session.add(MemoryRoutine(
            memory_id=m.id, elder_id=eid,
            time_of_day="08:00",
            description="बिहान उठेपछि पानी पिउनुहोस्, अनि Metformin खानुहोस्।",
            repeat_pattern="daily"
        ))

    # ── 4. Event memory (most important) ────────────────────
    if not has_memory("event"):
        m = Memory(elder_id=eid, type="event",
                   title="राम आज काठमाडौंमा छ",
                   source="caregiver", created_by=cg_user.id,
                   valid_from=now)
        db.session.add(m); db.session.flush()
        db.session.add(MemoryEvent(
            memory_id=m.id, elder_id=eid,
            related_person="Ram",
            message="राम आज काठमाडौंमा अफिसमा छ। बेलुका ५ बजे घर आउने छ। सब ठीकठाक छ।",
            photo_url=None,
            effective_from=now,
            effective_to=None
        ))

    # ── 5. Object memory ─────────────────────────────────────
    if not has_memory("object"):
        m = Memory(elder_id=eid, type="object",
                   title="चश्मा (Glasses)",
                   source="caregiver", created_by=cg_user.id)
        db.session.add(m); db.session.flush()
        db.session.add(MemoryObject(
            memory_id=m.id, elder_id=eid,
            object_name="चश्मा", usual_location="बेडसाइड टेबलमा, दराजको माथि",
            photo_url=None
        ))

    # ── 6. Reassurance memory ────────────────────────────────
    if not has_memory("reassurance"):
        m = Memory(elder_id=eid, type="reassurance",
                   title="सब ठीकठाक छ (All is well)",
                   source="caregiver", created_by=cg_user.id)
        db.session.add(m); db.session.flush()
        db.session.add(MemoryReassurance(
            memory_id=m.id, elder_id=eid,
            message="हजुर, सब ठीकठाक छ। परिवार सबैलाई हजुरको माया छ। चिन्ता नगर्नुहोस्।",
            voice_url=None,
            trigger_keywords="डर,चिन्ता,एक्लो,डराउनु,भ्रम"
        ))

    # ── Reminder (medicine at 8 AM) ──────────────────────────
    med_mem = db.session.query(Memory).filter_by(elder_id=eid, type="medicine").first()
    if med_mem and not Reminder.query.filter_by(elder_id=eid).first():
        db.session.add(Reminder(
            elder_id=eid, memory_id=med_mem.id,
            title="Metformin खाने समय",
            body="हजुर, बिहानको Metformin 500mg खाने बेला भयो!",
            scheduled_time="08:00",
            repeat_pattern="daily",
            active=True
        ))

    db.session.commit()
    return jsonify({"ok": True, "message": "Demo data seeded."})
