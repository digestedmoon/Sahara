import os
import uuid
from flask import Blueprint, jsonify, request, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt

media_bp = Blueprint("media", __name__, url_prefix="/api/media")

ALLOWED_EXTENSIONS = {
    "png", "jpg", "jpeg", "webp",
    "mp3", "wav", "m4a", "ogg"
}

def _is_caregiver():
    claims = get_jwt() or {}
    return claims.get("role") == "caregiver"

def _allowed(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS

@media_bp.post("/upload")
@jwt_required()
def upload():
    if not _is_caregiver():
        return jsonify({"error": "caregiver only"}), 403

    if "file" not in request.files:
        return jsonify({"error": "missing file field 'file'"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "empty filename"}), 400

    if not _allowed(f.filename):
        return jsonify({"error": "file type not allowed"}), 400

    uploads_dir = os.path.join(current_app.root_path, "..", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    ext = f.filename.rsplit(".", 1)[1].lower()
    new_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(uploads_dir, new_name)
    f.save(save_path)

    # public path to use in cards/docs
    public_url = f"/uploads/{new_name}"

    return jsonify({"ok": True, "url": public_url})