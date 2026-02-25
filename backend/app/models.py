"""
Memory Assistance App — Database Models
Full 13-table schema per master build specification.
"""
from datetime import datetime
from app.extensions import db


# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"
    id            = db.Column(db.Integer, primary_key=True)
    email         = db.Column(db.String(255), unique=True, nullable=False)
    password      = db.Column(db.String(255), nullable=False)   # plaintext for MVP
    role          = db.Column(db.String(20), nullable=False)    # 'elder' | 'caregiver'
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────
# PROFILES
# ─────────────────────────────────────────

class Elder(db.Model):
    __tablename__ = "elders"
    id                 = db.Column(db.Integer, primary_key=True)
    user_id            = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    name               = db.Column(db.String(255), nullable=False)
    preferred_language = db.Column(db.String(10), default="ne")   # 'ne' | 'en'
    timezone           = db.Column(db.String(64),  default="Asia/Kathmandu")
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CaregiverElderMap(db.Model):
    """Which caregiver manages which elder."""
    __tablename__ = "caregiver_elder_map"
    id           = db.Column(db.Integer, primary_key=True)
    caregiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    elder_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role         = db.Column(db.String(20), default="primary")   # 'primary' | 'secondary'
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("caregiver_id", "elder_id"),)


# ─────────────────────────────────────────
# MEMORIES — MASTER TABLE
# ─────────────────────────────────────────

MEMORY_TYPES = ("person", "medicine", "routine", "event", "object", "reassurance")

class Memory(db.Model):
    """Master registry for all memory types."""
    __tablename__ = "memories"
    id          = db.Column(db.Integer, primary_key=True)
    elder_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    type        = db.Column(db.String(30), nullable=False)   # one of MEMORY_TYPES
    title       = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    source      = db.Column(db.String(30), default="caregiver")  # 'caregiver' | 'system'
    valid_from  = db.Column(db.DateTime, nullable=True)
    valid_to    = db.Column(db.DateTime, nullable=True)
    created_by  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─────────────────────────────────────────
# MEMORY EXTENSION TABLES
# ─────────────────────────────────────────

class MemoryPerson(db.Model):
    """6.1 Person Memory — who someone is."""
    __tablename__ = "memory_person"
    id           = db.Column(db.Integer, primary_key=True)
    memory_id    = db.Column(db.Integer, db.ForeignKey("memories.id", ondelete="CASCADE"), unique=True, nullable=False)
    elder_id     = db.Column(db.Integer, nullable=False, index=True)
    name         = db.Column(db.String(255), nullable=False)
    relationship = db.Column(db.String(100), nullable=True)   # son / daughter / doctor …
    photo_url    = db.Column(db.String(500), nullable=True)
    phone        = db.Column(db.String(30),  nullable=True)


class MemoryMedicine(db.Model):
    """6.2 Medicine Memory."""
    __tablename__ = "memory_medicine"
    id        = db.Column(db.Integer, primary_key=True)
    memory_id = db.Column(db.Integer, db.ForeignKey("memories.id", ondelete="CASCADE"), unique=True, nullable=False)
    elder_id  = db.Column(db.Integer, nullable=False, index=True)
    name      = db.Column(db.String(255), nullable=False)
    dosage    = db.Column(db.String(100), nullable=True)
    reason    = db.Column(db.Text, nullable=True)      # simple plain-language explanation
    voice_url = db.Column(db.String(500), nullable=True)


class MemoryRoutine(db.Model):
    """6.3 Routine Memory — daily structure."""
    __tablename__ = "memory_routine"
    id             = db.Column(db.Integer, primary_key=True)
    memory_id      = db.Column(db.Integer, db.ForeignKey("memories.id", ondelete="CASCADE"), unique=True, nullable=False)
    elder_id       = db.Column(db.Integer, nullable=False, index=True)
    time_of_day    = db.Column(db.String(10), nullable=True)   # "08:00"
    description    = db.Column(db.Text, nullable=True)
    repeat_pattern = db.Column(db.String(50), nullable=True)   # "daily" | "weekdays" | "Mon,Wed,Fri"


class MemoryEvent(db.Model):
    """6.4 Event Memory — caregiver updates (MOST IMPORTANT)."""
    __tablename__ = "memory_event"
    id             = db.Column(db.Integer, primary_key=True)
    memory_id      = db.Column(db.Integer, db.ForeignKey("memories.id", ondelete="CASCADE"), nullable=False)
    elder_id       = db.Column(db.Integer, nullable=False, index=True)
    related_person = db.Column(db.String(255), nullable=True)  # name of the person the event is about
    message        = db.Column(db.Text, nullable=False)
    photo_url      = db.Column(db.String(500), nullable=True)
    effective_from = db.Column(db.DateTime, nullable=True)
    effective_to   = db.Column(db.DateTime, nullable=True)     # NULL = open-ended / still valid


class MemoryObject(db.Model):
    """6.5 Object Memory — usual location of items."""
    __tablename__ = "memory_object"
    id             = db.Column(db.Integer, primary_key=True)
    memory_id      = db.Column(db.Integer, db.ForeignKey("memories.id", ondelete="CASCADE"), unique=True, nullable=False)
    elder_id       = db.Column(db.Integer, nullable=False, index=True)
    object_name    = db.Column(db.String(255), nullable=False)
    usual_location = db.Column(db.Text, nullable=True)
    photo_url      = db.Column(db.String(500), nullable=True)


class MemoryReassurance(db.Model):
    """6.6 Reassurance Memory — calming messages."""
    __tablename__ = "memory_reassurance"
    id               = db.Column(db.Integer, primary_key=True)
    memory_id        = db.Column(db.Integer, db.ForeignKey("memories.id", ondelete="CASCADE"), unique=True, nullable=False)
    elder_id         = db.Column(db.Integer, nullable=False, index=True)
    message          = db.Column(db.Text, nullable=True)
    voice_url        = db.Column(db.String(500), nullable=True)
    trigger_keywords = db.Column(db.Text, nullable=True)   # comma-separated


# ─────────────────────────────────────────
# REMINDERS
# ─────────────────────────────────────────

class Reminder(db.Model):
    __tablename__ = "reminders"
    id             = db.Column(db.Integer, primary_key=True)
    elder_id       = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    memory_id      = db.Column(db.Integer, db.ForeignKey("memories.id", ondelete="SET NULL"), nullable=True)
    title          = db.Column(db.String(255), nullable=False)
    body           = db.Column(db.Text, nullable=True)
    scheduled_time = db.Column(db.String(10), nullable=False)   # "HH:MM" 24h
    repeat_pattern = db.Column(db.String(50), default="daily")  # daily | weekdays | once
    active         = db.Column(db.Boolean, default=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)


class ReminderAction(db.Model):
    """Elder's response to a reminder."""
    __tablename__ = "reminder_actions"
    id          = db.Column(db.Integer, primary_key=True)
    reminder_id = db.Column(db.Integer, db.ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False, index=True)
    elder_id    = db.Column(db.Integer, nullable=False, index=True)
    action      = db.Column(db.String(20), nullable=False)   # 'taken' | 'later' | 'missed'
    timestamp   = db.Column(db.DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────
# LOGS
# ─────────────────────────────────────────

class InteractionLog(db.Model):
    """Tracks every AI query the elder makes."""
    __tablename__ = "interaction_logs"
    id            = db.Column(db.Integer, primary_key=True)
    elder_id      = db.Column(db.Integer, nullable=False, index=True)
    intent        = db.Column(db.String(50), nullable=True)
    raw_query     = db.Column(db.Text, nullable=True)
    response_type = db.Column(db.String(30), nullable=True)   # 'memory' | 'fallback' | 'emergency'
    confidence    = db.Column(db.Float, nullable=True)
    timestamp     = db.Column(db.DateTime, default=datetime.utcnow)


class EmergencyEvent(db.Model):
    """Tracks emergency triggers."""
    __tablename__ = "emergency_events"
    id             = db.Column(db.Integer, primary_key=True)
    elder_id       = db.Column(db.Integer, nullable=False, index=True)
    trigger        = db.Column(db.String(100), nullable=True)  # 'voice' | 'button' | 'confusion'
    contact_called = db.Column(db.String(255), nullable=True)
    timestamp      = db.Column(db.DateTime, default=datetime.utcnow)
