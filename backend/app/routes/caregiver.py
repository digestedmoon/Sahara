import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from app.extensions import db, socketio
from app.models import User, Elder, Event, Medication, Card, KnowledgeDoc, VitalSign, CareContact, ScheduleItem
from app.rag.embeddings import embed_text

caregiver_bp = Blueprint("caregiver", __name__, url_prefix="/api/caregiver")

def _is_caregiver():
    try:
        claims = get_jwt()
        return claims.get("role") == "caregiver"
    except Exception:
        return False

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
    media_url = data.get("media_url")
    payload = data.get("payload")

    if not elder_id_raw or not title_nepali or not body_nepali:
        return jsonify({"error": "elder_id, title_nepali, body_nepali are required"}), 400

    if elder_id_raw is None:
        return jsonify({"error": "elder_id is required"}), 400

    try:
        elder_id = int(elder_id_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid elder_id"}), 400

    payload_json = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else None

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

    evt = Event(
        elder_id=elder_id,
        event_type="CARD_CREATED",
        payload_json=json.dumps({"type": card_type, "text": f"Created {card_type}: {title_nepali}"}, ensure_ascii=False),
    )
    db.session.add(evt)
    db.session.commit()

    # Emit real-time event
    from datetime import datetime
    socketio.emit('new_event', {
        'elder_id': elder_id,
        'event_type': 'CARD_CREATED',
        'text': f"Created {card_type}: {title_nepali}",
        'created_at': datetime.utcnow().isoformat()
    })

    return jsonify({"ok": True, "card_id": card.id})

@caregiver_bp.post("/knowledge")
@jwt_required()
def add_knowledge():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    data = request.get_json(silent=True) or {}
    elder_id = data.get("elder_id")
    title = data.get("title")
    content_nepali = data.get("content_nepali")
    doc_type = data.get("doc_type", "GENERAL")

    if not elder_id or not title or not content_nepali:
        return jsonify({"error": "elder_id, title, content_nepali are required"}), 400

    try:
        embedding = embed_text(content_nepali)
        if elder_id is None:
            return jsonify({"error": "elder_id is required"}), 400
            
        doc = KnowledgeDoc(
            elder_id=int(elder_id),
            doc_type=doc_type,
            title=title,
            content_nepali=content_nepali,
            embedding_json=json.dumps(embedding)
        )
        db.session.add(doc)
        db.session.commit()
        return jsonify({"ok": True, "doc_id": doc.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@caregiver_bp.get("/dashboard")
@jwt_required()
def get_dashboard():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403
    
    elders_count = User.query.filter_by(role="elder").count()
    active_alerts = Event.query.filter_by(event_type="HELP_REQUESTED").count()
    meds_given = Medication.query.filter_by(taken=True).count()
    
    # Real elder data join
    elders_list = []
    # Join User and Elder
    results = db.session.query(User, Elder).filter(User.id == Elder.user_id).filter(User.role == "elder").all()
    
    for user, elder in results:
        # Get last activity
        last_evt = Event.query.filter_by(elder_id=user.id).order_by(Event.created_at.desc()).first()
        last_time = "N/A"
        if last_evt:
            diff = (db.func.now() - last_evt.created_at)
            # Simple diff string logic (simplified for brevity)
            last_time = "Just now" # Replace with actual timeago if needed
            
        elders_list.append({
            "id": user.id,
            "name": elder.full_name,
            "age": 75, # Placeholder or add to Elder model
            "room": "Room " + str(user.id),
            "status": "Healthy" if active_alerts == 0 else "Alert",
            "score": 85,
            "med": "Checked",
            "last": last_time
        })
        
    activities = []
    recent_events = Event.query.order_by(Event.created_at.desc()).limit(5).all()
    for ev in recent_events:
        activities.append({
            "color": "var(--primary)" if "CREATED" in ev.event_type else "var(--danger)",
            "text": f"{ev.event_type} for Elder {ev.elder_id}",
            "time": "Recent"
        })
    
    return jsonify({
        "stats": [
            {"icon": "👴", "label": "Elders Under Care", "value": str(elders_count), "change": "Live", "dir": "up", "color": "var(--primary)", "bg": "var(--primary-subtle)"},
            {"icon": "🔔", "label": "Active Alerts", "value": str(active_alerts), "change": "Real-time", "dir": "down", "color": "var(--danger)", "bg": "rgba(239,68,68,0.1)"},
            {"icon": "💊", "label": "Meds Administered", "value": str(meds_given), "change": "Today", "dir": "up", "color": "var(--primary)", "bg": "var(--primary-subtle)"},
            {"icon": "📊", "label": "Avg Health Score", "value": "88", "change": "Good", "dir": "up", "color": "var(--primary)", "bg": "var(--primary-subtle)"},
        ],
        "elders": elders_list,
        "activity": activities
    })

@caregiver_bp.post("/intake")
@jwt_required()
def elder_intake():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    data = request.get_json(silent=True) or {}
    elder_id = data.get("elder_id")
    profile = data.get("profile", {})
    contacts = data.get("contacts", [])
    meds = data.get("medications", [])
    schedule = data.get("schedule", [])

    if not elder_id:
        return jsonify({"error": "elder_id is required"}), 400

    try:
        # 1. Update Elder Profile
        elder = Elder.query.filter_by(user_id=elder_id).first()
        if not elder:
            # Create if not exists (safety fallback)
            elder = Elder(user_id=elder_id, full_name=profile.get("full_name", "Unknown Elder"))
            db.session.add(elder)
        
        if "full_name" in profile: elder.full_name = profile["full_name"]
        if "description" in profile: elder.description = profile["description"]
        if "medical_summary" in profile: elder.medical_summary = profile["medical_summary"]

        # 2. Update Contacts (Overwrite)
        CareContact.query.filter_by(elder_id=elder_id).delete()
        for c in contacts:
            db.session.add(CareContact(
                elder_id=elder_id,
                name=c.get("name"),
                relationship=c.get("relationship"),
                phone=c.get("phone"),
                priority=c.get("priority", 1),
                notes=c.get("notes")
            ))

        # 3. Update Medications (Overwrite)
        Medication.query.filter_by(elder_id=elder_id).delete()
        for m in meds:
            db.session.add(Medication(
                elder_id=elder_id,
                name=m.get("name"),
                time=m.get("time"),
                taken=m.get("taken", False),
                note=m.get("note")
            ))

        # 4. Update Schedule (Overwrite)
        ScheduleItem.query.filter_by(elder_id=elder_id).delete()
        for s in schedule:
            db.session.add(ScheduleItem(
                elder_id=elder_id,
                time=s.get("time"),
                event=s.get("event"),
                icon=s.get("icon"),
                color=s.get("color")
            ))

        # 5. Create KnowledgeDoc (Summary for RAG)
        # Build a structured Nepali text summary
        summary_lines = [
            f"आमा/बुबाको नाम: {elder.full_name}",
            f"बारेमा: {elder.description or 'उपलब्ध छैन'}",
            f"स्वास्थ्य अवस्था: {elder.medical_summary or 'उपलब्ध छैन'}",
            "\n[सम्पर्क व्यक्तिहरू]",
        ]
        for c in contacts:
            summary_lines.append(f"- {c['name']} ({c['relationship']}): {c['phone']}")
        
        summary_lines.append("\n[नियमित औषधिहरू]")
        for m in meds:
            summary_lines.append(f"- {m['name']} (समय: {m['time']})")

        kb_content = "\n".join(summary_lines)
        embedding = embed_text(kb_content)
        
        knowledge = KnowledgeDoc(
            elder_id=elder_id,
            doc_type="INTAKE_SUMMARY",
            title=f"Intake Summary - {elder.full_name}",
            content_nepali=kb_content,
            embedding_json=json.dumps(embedding)
        )
        db.session.add(knowledge)

        db.session.commit()
        return jsonify({"ok": True, "message": "Intake completed and AI memory updated."})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@caregiver_bp.get("/elder/<int:elder_id>/full")
@jwt_required()
def get_elder_full_profile(elder_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    elder = Elder.query.filter_by(user_id=elder_id).first()
    if not elder:
        return jsonify({"error": "elder not found"}), 404

    contacts = CareContact.query.filter_by(elder_id=elder_id).all()
    meds = Medication.query.filter_by(elder_id=elder_id).all()
    schedule = ScheduleItem.query.filter_by(elder_id=elder_id).all()

    return jsonify({
        "profile": {
            "full_name": elder.full_name,
            "description": elder.description,
            "medical_summary": elder.medical_summary
        },
        "contacts": [
            {
                "name": c.name,
                "relationship": c.relationship,
                "phone": c.phone,
                "priority": c.priority,
                "notes": c.notes
            } for c in contacts
        ],
        "medications": [
            {
                "name": m.name,
                "time": m.time,
                "note": m.note,
                "taken": m.taken
            } for m in meds
        ],
        "schedule": [
            {
                "time": s.time,
                "event": s.event,
                "icon": s.icon,
                "color": s.color
            } for s in schedule
        ]
    })
