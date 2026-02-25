import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from app.config import Config
from app.extensions import db, jwt, socketio, eleven_client


def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)

    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app)

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

    # ── Create tables ────────────────────────────────────────
    with app.app_context():
        db.create_all()

    # ── Background scheduler (reminder push) ─────────────────
    from app.services.scheduler import start_scheduler
    start_scheduler(app)

    return app