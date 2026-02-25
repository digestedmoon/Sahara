import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from app.config import Config
from app.extensions import db, jwt, socketio, eleven_client, scheduler
import datetime


# Change the definition to accept 'app'
def check_reminders(app):
    with app.app_context():
        now = datetime.datetime.now().strftime("%H:%M")
        
        from app.models import Reminder
        from app.extensions import socketio
        from app.utils.tts import generate_tts_base64
        
        due = Reminder.query.filter_by(active=True, scheduled_time=now).all()
        for r in due:
            voice_text = f"औषधी खाने समय भयो: {r.title}"
            audio_b64 = generate_tts_base64(voice_text)
            
            socketio.emit('reminder_due', {
                'id': r.id,
                'title': r.title,
                'voice_text': voice_text,
                'audio_content': audio_b64
            }, to=f"elder_{r.elder_id}")

def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)

    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app)
    # Initialize and Start the Scheduler
    scheduler.init_app(app)
    scheduler.start()

    # Schedule the task to run every minute
    if not scheduler.get_job('reminder_check_job'):
        scheduler.add_job(
            id='reminder_check_job', 
            func=check_reminders, 
            trigger='interval', 
            seconds=60,
            args=[app],
            replace_existing=True
        )

    # Import models so SQLAlchemy registers all tables
    from app import models  # noqa: F401

    # ── Core blueprints ──────────────────────────────────────
    from app.routes.health    import health_bp
    from app.routes.auth      import auth_bp
    from app.routes.memory    import memory_bp
    from app.routes.query     import query_bp
    from app.routes.reminders import reminders_bp
    from app.routes.emergency import emergency_bp
    from app.routes.caregiver import caregiver_bp
    from app.routes.media     import media_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(memory_bp)
    app.register_blueprint(query_bp)
    app.register_blueprint(reminders_bp)
    app.register_blueprint(emergency_bp)
    app.register_blueprint(caregiver_bp)
    app.register_blueprint(media_bp)

    # ── WebSocket Events ─────────────────────────────────────
    from app.routes import sockets  # noqa: F401

    # ── Create tables ────────────────────────────────────────
    with app.app_context():
        db.create_all()

    return app