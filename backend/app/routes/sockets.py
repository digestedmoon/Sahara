from flask_socketio import join_room
from app.extensions import socketio

@socketio.on('join_room')
def handle_join(data):
    # data will be something like {'elder_id': 2} or {'caregiver_id': 1}
    # Elder rooms: elder_2
    # Caregiver rooms: caregiver_1
    room = ""
    if 'elder_id' in data:
        room = f"elder_{data['elder_id']}"
        join_room(room)
        print(f"Elder {data['elder_id']} joined their private room {room}.")
    elif 'caregiver_id' in data:
        room = f"caregiver_{data['caregiver_id']}"
        join_room(room)
        print(f"Caregiver {data['caregiver_id']} joined their private room {room}.")

def emit_caregiver_alert(caregiver_id: int, alert_type: str, message: str, payload: dict = None):
    """Utility to push real-time alerts to a specific caregiver."""
    if payload is None:
        payload = {}
    
    event_data = {
        "type": alert_type,
        "message": message,
        "payload": payload,
        "timestamp": __import__('datetime').datetime.utcnow().isoformat()
    }
    
    room = f"caregiver_{caregiver_id}"
    socketio.emit('system_alert', event_data, room=room)
    print(f"Emitted system_alert to {room}: {alert_type}")