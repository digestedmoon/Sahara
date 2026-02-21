import time
from datetime import datetime
from threading import Thread
from app.extensions import db, socketio
from app.models import Medication, ScheduleItem, Card, Event, User
import json

def start_scheduler(app):
    def run_scheduler():
        with app.app_context():
            print("🕒 Scheduler started...")
            while True:
                try:
                    now = datetime.now()
                    current_time_str = now.strftime("%H:%M") # e.g. "08:30"
                    
                    # 1. Check Medications
                    pending_meds = Medication.query.filter_by(taken=False).all()
                    for med in pending_meds:
                        # Simple string comparison for MVP
                        if med.time == current_time_str or med.time in current_time_str:
                            _create_medication_card(med)

                    # 2. Check Schedule Items
                    # (Similar logic for routine tasks)
                    
                    db.session.commit()
                except Exception as e:
                    print(f"❌ Scheduler Error: {e}")
                    db.session.rollback()
                
                time.sleep(60) # check every minute

    thread = Thread(target=run_scheduler, daemon=True)
    thread.start()

def _create_medication_card(med):
    # Check if card already exists for today to avoid duplicates
    existing = Card.query.filter_by(
        elder_id=med.elder_id, 
        type="MED", 
        status="active"
    ).filter(Card.title_nepali.contains(med.name)).first()
    
    if existing:
        return

    card = Card(
        elder_id=med.elder_id,
        type="MED",
        title_nepali=f"औषधि समय: {med.name}",
        body_nepali=f"हजुर 😊 अब {med.name} लिनुहोस्। समय: {med.time}",
        status="active"
    )
    db.session.add(card)
    db.session.flush()

    # Log event
    evt = Event(
        elder_id=med.elder_id,
        event_type="AUTO_CARD_CREATED",
        payload_json=json.dumps({"type": "MED", "name": med.name, "text": f"Auto-scheduled medication: {med.name}"})
    )
    db.session.add(evt)
    
    # Emit real-time event to socket
    socketio.emit('new_event', {
        'elder_id': med.elder_id,
        'event_type': 'AUTO_CARD_CREATED',
        'text': f"Auto-scheduled medication: {med.name}",
        'created_at': datetime.utcnow().isoformat()
    }, room=f"elder_{med.elder_id}")
    
    print(f"✅ Auto-created medication card for {med.name}")
