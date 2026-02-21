from datetime import datetime
from app.extensions import db

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=False)
    password = db.Column(db.String, nullable=False)
    role = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class KnowledgeDoc(db.Model):
    __tablename__ = "knowledge_docs"
    id = db.Column(db.Integer, primary_key=True)
    elder_id = db.Column(db.Integer, index=True, nullable=False)
    doc_type = db.Column(db.String, nullable=False)
    title = db.Column(db.String, nullable=False)
    content_nepali = db.Column(db.Text, nullable=False)
    embedding_json = db.Column(db.Text, nullable=True)  # JSON list[float]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Event(db.Model):
    __tablename__ = "events"
    id = db.Column(db.Integer, primary_key=True)
    elder_id = db.Column(db.Integer, index=True, nullable=False)
    event_type = db.Column(db.String, nullable=False)
    payload_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Card(db.Model):
    __tablename__ = "cards"
    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(db.Integer, index=True, nullable=False)

    # MED, VISITOR, ROUTINE, PRESENCE, MEMORY etc.
    type = db.Column(db.String, nullable=False)

    title_nepali = db.Column(db.String, nullable=False)
    body_nepali = db.Column(db.Text, nullable=False)

    # pill image URL or path
    media_url = db.Column(db.String, nullable=True)

    # store flexible structured metadata (pill_color, med_name, time_hint, etc.)
    payload_json = db.Column(db.Text, nullable=True)

    due_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String, nullable=False, default="active")  # active/ack/expired
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    

class Elder(db.Model):
    __tablename__ = "elders"
    id = db.Column(db.Integer, primary_key=True)

    # This matches your elder user id (elder@test.com etc.)
    user_id = db.Column(db.Integer, unique=True, index=True, nullable=False)

    full_name = db.Column(db.String, nullable=False)
    description = db.Column(db.Text, nullable=True)
    medical_summary = db.Column(db.Text, nullable=True)
    language = db.Column(db.String, default="ne", nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CareContact(db.Model):
    __tablename__ = "care_contacts"
    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(db.Integer, index=True, nullable=False)

    name = db.Column(db.String, nullable=False)
    relationship = db.Column(db.String, nullable=False)   # son/daughter/caregiver/NRN/doctor
    phone = db.Column(db.String, nullable=False)

    priority = db.Column(db.Integer, default=1)          # 1 = call first
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VitalSign(db.Model):
    __tablename__ = "vital_signs"
    id = db.Column(db.Integer, primary_key=True)
    elder_id = db.Column(db.Integer, index=True, nullable=False)
    vital_type = db.Column(db.String, nullable=False) # e.g. "heart_rate"
    label = db.Column(db.String, nullable=False)      # e.g. "Heart Rate"
    value = db.Column(db.String, nullable=False)
    unit = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=True)
    trend = db.Column(db.String, nullable=True)
    icon = db.Column(db.String, nullable=True)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)


class Medication(db.Model):
    __tablename__ = "medications"
    id = db.Column(db.Integer, primary_key=True)
    elder_id = db.Column(db.Integer, index=True, nullable=False)
    name = db.Column(db.String, nullable=False)
    time = db.Column(db.String, nullable=False) # e.g. "08:00 AM"
    taken = db.Column(db.Boolean, default=False)
    note = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ScheduleItem(db.Model):
    __tablename__ = "schedule_items"
    id = db.Column(db.Integer, primary_key=True)
    elder_id = db.Column(db.Integer, index=True, nullable=False)
    time = db.Column(db.String, nullable=False) # e.g. "10:00"
    event = db.Column(db.String, nullable=False)
    icon = db.Column(db.String, nullable=True)
    color = db.Column(db.String, nullable=True)
    date = db.Column(db.Date, default=datetime.utcnow().date)
