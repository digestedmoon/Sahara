import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt

from app.extensions import db
from app.models import Elder, CareContact, KnowledgeDoc
from app.rag.embeddings import embed_text

profile_bp = Blueprint("profile", __name__, url_prefix="/api/caregiver")

def _is_caregiver():
    claims = get_jwt() or {}
    return claims.get("role") == "caregiver"

def _upsert_knowledge_doc(elder_user_id: int, doc_type: str, title: str, content: str):
    # Keep RAG in sync: create/update KnowledgeDoc
    doc = (
        db.session.query(KnowledgeDoc)
        .filter(KnowledgeDoc.elder_id == elder_user_id, KnowledgeDoc.doc_type == doc_type)
        .first()
    )
    vec = embed_text(content)
    emb_json = json.dumps(vec, ensure_ascii=False)

    if doc:
        doc.title = title
        doc.content_nepali = content
        doc.embedding_json = emb_json
    else:
        doc = KnowledgeDoc(
            elder_id=elder_user_id,
            doc_type=doc_type,
            title=title,
            content_nepali=content,
            embedding_json=emb_json,
        )
        db.session.add(doc)

@profile_bp.post("/elder_profile")
@jwt_required()
def create_or_update_elder_profile():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")   # elder's user_id (e.g. 2)
    full_name = data.get("full_name")
    description = data.get("description")
    medical_summary = data.get("medical_summary")
    language = data.get("language", "ne")

    if not user_id or not full_name:
        return jsonify({"error": "user_id and full_name are required"}), 400

    elder = db.session.query(Elder).filter(Elder.user_id == int(user_id)).first()
    if not elder:
        elder = Elder(user_id=int(user_id), full_name=full_name, language=language)
        db.session.add(elder)

    elder.full_name = full_name
    elder.description = description
    elder.medical_summary = medical_summary
    elder.language = language
    db.session.commit()

    # sync to RAG as PROFILE doc
    content = f"नाम: {full_name}\nविवरण: {description or ''}\nस्वास्थ्य सारांश: {medical_summary or ''}\nभाषा: {language}"
    _upsert_knowledge_doc(int(user_id), "PROFILE", "प्रोफाइल", content)
    db.session.commit()

    return jsonify({"ok": True, "elder_id": elder.id})


@profile_bp.get("/elder_profile/<int:user_id>")
@jwt_required()
def get_elder_profile(user_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    elder = db.session.query(Elder).filter(Elder.user_id == user_id).first()
    if not elder:
        return jsonify({"elder": None})

    return jsonify({
        "elder": {
            "id": elder.id,
            "user_id": elder.user_id,
            "full_name": elder.full_name,
            "description": elder.description,
            "medical_summary": elder.medical_summary,
            "language": elder.language,
            "updated_at": elder.updated_at.isoformat()
        }
    })


@profile_bp.post("/care_contacts")
@jwt_required()
def add_care_contact():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    data = request.get_json(silent=True) or {}
    elder_user_id = data.get("elder_user_id")  # elder's user_id (e.g. 2)
    name = data.get("name")
    relationship = data.get("relationship")
    phone = data.get("phone")
    priority = data.get("priority", 1)
    notes = data.get("notes")

    if not all([elder_user_id, name, relationship, phone]):
        return jsonify({"error": "elder_user_id, name, relationship, phone required"}), 400

    contact = CareContact(
        elder_id=int(elder_user_id),
        name=name,
        relationship=relationship,
        phone=phone,
        priority=int(priority),
        notes=notes,
    )
    db.session.add(contact)
    db.session.commit()

    # sync all contacts into a CARE_NETWORK doc for RAG
    contacts = (
        db.session.query(CareContact)
        .filter(CareContact.elder_id == int(elder_user_id))
        .order_by(CareContact.priority.asc())
        .all()
    )
    lines = []
    for c in contacts:
        lines.append(f"{c.priority}) {c.relationship}: {c.name}, फोन: {c.phone}. {c.notes or ''}".strip())
    content = "सम्पर्क सूची:\n" + "\n".join(lines)

    _upsert_knowledge_doc(int(elder_user_id), "CARE_NETWORK", "सम्पर्क सूची", content)
    db.session.commit()

    return jsonify({"ok": True, "contact_id": contact.id})


@profile_bp.get("/care_contacts/<int:elder_user_id>")
@jwt_required()
def list_care_contacts(elder_user_id):
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    contacts = (
        db.session.query(CareContact)
        .filter(CareContact.elder_id == elder_user_id)
        .order_by(CareContact.priority.asc())
        .all()
    )

    return jsonify({
        "contacts": [
            {
                "id": c.id,
                "name": c.name,
                "relationship": c.relationship,
                "phone": c.phone,
                "priority": c.priority,
                "notes": c.notes,
            } for c in contacts
        ]
    })