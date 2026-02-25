from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from elevenlabs.client import ElevenLabs
import os

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*")
eleven_client = ElevenLabs(api_key=os.getenv("ELEVEN_API_KEY"))