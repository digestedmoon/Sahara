from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.post("/seed")
def seed():
    from app.models import VitalSign, Medication, ScheduleItem

    caregiver = User.query.filter_by(email="caregiver@test.com").first()
    elder = User.query.filter_by(email="elder@test.com").first()

    if not caregiver:
        caregiver = User(email="caregiver@test.com", password="pass", role="caregiver")
        db.session.add(caregiver)
    if not elder:
        elder = User(email="elder@test.com", password="pass", role="elder")
        db.session.add(elder)

    db.session.commit()

    # Seed Dashboard Data if not exists
    if not VitalSign.query.filter_by(elder_id=elder.id).first():
        db.session.add_all([
            VitalSign(elder_id=elder.id, vital_type="heart_rate", label="Heart Rate", value="72", unit="bpm", status="Normal", trend="↔ Stable", icon="❤️"),
            VitalSign(elder_id=elder.id, vital_type="blood_pressure", label="Blood Pressure", value="118/76", unit="mmHg", status="Good", trend="↗ Improving", icon="🩺"),
            VitalSign(elder_id=elder.id, vital_type="blood_sugar", label="Blood Sugar", value="94", unit="mg/dL", status="Normal", trend="↔ Stable", icon="🩸"),
            VitalSign(elder_id=elder.id, vital_type="spo2", label="SpO₂", value="98", unit="%", status="Great", trend="↗ Good", icon="🫁")
        ])
    
    if not Medication.query.filter_by(elder_id=elder.id).first():
        db.session.add_all([
            Medication(elder_id=elder.id, name="Metformin 500mg", time="8:00 AM", taken=True, note="With breakfast"),
            Medication(elder_id=elder.id, name="Lisinopril 10mg", time="2:00 PM", taken=False, note="Due in 2 hours"),
            Medication(elder_id=elder.id, name="Vitamin D3 1000IU", time="2:00 PM", taken=False, note="With lunch"),
            Medication(elder_id=elder.id, name="Aspirin 75mg", time="9:00 PM", taken=False, note="After dinner")
        ])

    if not ScheduleItem.query.filter_by(elder_id=elder.id).first():
        db.session.add_all([
            ScheduleItem(elder_id=elder.id, time="10:00", event="Physiotherapy Session", icon="🏃", color="var(--primary)"),
            ScheduleItem(elder_id=elder.id, time="12:00", event="Lunch", icon="🍽", color="var(--primary)"),
            ScheduleItem(elder_id=elder.id, time="14:00", event="Dr. Patel Check-up", icon="🩺", color="var(--primary)"),
            ScheduleItem(elder_id=elder.id, time="16:00", event="Family Video Call", icon="📱", color="var(--primary)"),
            ScheduleItem(elder_id=elder.id, time="18:00", event="Evening Walk", icon="🚶", color="var(--primary)")
        ])

    db.session.commit()
    return jsonify({"ok": True})

@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or user.password != password:
        return jsonify({"error": "invalid credentials"}), 401

    # ✅ identity must be a string (goes into JWT "sub")
    identity = str(user.id)

    # ✅ put role/email into claims
    claims = {"role": user.role, "email": user.email}

    token = create_access_token(identity=identity, additional_claims=claims)
    return jsonify({
        "access_token": token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "name": user.email.split('@')[0].capitalize()
        }
    })
