import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from app.config import Config
from app.extensions import db, jwt


def create_app():
    # ✅ Load environment variables from .env
    load_dotenv()

    app = Flask(__name__)

    # ✅ Apply config (DB, JWT secret, etc.)
    app.config.from_object(Config)

    # ✅ Allow frontend to talk to backend later
    CORS(app)

    # ✅ Initialize extensions
    db.init_app(app)
    jwt.init_app(app)

    # ✅ Import models so SQLAlchemy knows them
    from app import models  # noqa: F401

    # ✅ Register API routes (blueprints)
    from app.routes.health import health_bp
    from app.routes.auth import auth_bp
    from app.routes.caregiver import caregiver_bp
    from app.routes.rag import rag_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(caregiver_bp)
    app.register_blueprint(rag_bp)

    from app.routes.elder import elder_bp
    app.register_blueprint(elder_bp)

    from app.routes.detect import detect_bp
    app.register_blueprint(detect_bp)

    from app.routes.caregiver_events import caregiver_events_bp
    app.register_blueprint(caregiver_events_bp)

    from app.routes.profile import profile_bp
    app.register_blueprint(profile_bp)

    from app.routes.events import events_bp
    app.register_blueprint(events_bp)
    
    from app.routes.media import media_bp
    app.register_blueprint(media_bp)    

    # (Later you will also add elder_bp, pairing_bp, etc.)

    # ✅ Create DB tables automatically (MVP mode)
    with app.app_context():
        db.create_all()

    return app