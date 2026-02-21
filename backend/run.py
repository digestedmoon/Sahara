import os
from flask import send_from_directory
from app import create_app

from app.extensions import socketio

app = create_app()

@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    uploads_dir = os.path.join(app.root_path, "..", "uploads")
    return send_from_directory(uploads_dir, filename)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)