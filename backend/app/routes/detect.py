import io
import json
import os
import time
import uuid
import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, jsonify, request
from PIL import Image

from google import genai
from google.genai import types

# -------------------------
# Logging
# -------------------------
logger = logging.getLogger("saharaai.detect")

# -------------------------
# Blueprint
# -------------------------
detect_bp = Blueprint("detect", __name__, url_prefix="/api")

# -------------------------
# Helpers
# -------------------------
def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def require_api_key() -> None:
    if not os.getenv("GEMINI_API_KEY"):
        logger.error("Missing GEMINI_API_KEY for detection")

# -------------------------
# Detection data model
# -------------------------
@dataclass
class Detection:
    label: str
    box_2d: Tuple[int, int, int, int]  # [ymin, xmin, ymax, xmax] normalized 0..1000
    confidence: Optional[float] = None

    def to_abs_xyxy(self, width: int, height: int) -> Tuple[int, int, int, int]:
        """Convert normalized [ymin,xmin,ymax,xmax] (0..1000) -> absolute pixels."""
        y0, x0, y1, x1 = self.box_2d
        x0p = int(x0 / 1000.0 * width)
        y0p = int(y0 / 1000.0 * height)
        x1p = int(x1 / 1000.0 * width)
        y1p = int(y1 / 1000.0 * height)

        x0p = max(0, min(width - 1, x0p))
        y0p = max(0, min(height - 1, y0p))
        x1p = max(0, min(width - 1, x1p))
        y1p = max(0, min(height - 1, y1p))

        if x1p < x0p:
            x0p, x1p = x1p, x0p
        if y1p < y0p:
            y0p, y1p = y1p, y0p

        return x0p, y0p, x1p, y1p

# -------------------------
# Gemini detection prompt
# -------------------------
DETECTION_PROMPT = """
You are an object detection system.

Detect:
1) every human (label exactly "person")
2) all other prominent objects in the image (use simple labels like "sunglasses", "glasses", "phone", "bottle", "chair")

Return ONLY valid JSON (no markdown), as a list of objects with keys:
- "label": string
- "box_2d": [ymin, xmin, ymax, xmax] normalized to 0..1000 (integers)
- "confidence": number between 0 and 1 (optional)

Rules:
- box_2d must be integers in [0,1000]
- Use concise, common labels
"""

def parse_detections(raw: str) -> List[Detection]:
    raw = raw.strip()

    # Best-effort cleanup if model returns fenced blocks.
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1] if raw.count("```") >= 2 else raw
        raw = raw.replace("json", "", 1).strip()
        raw = raw.split("```", 1)[0].strip()

    data = json.loads(raw)
    if not isinstance(data, list):
        return []

    dets: List[Detection] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip().lower()
        box = item.get("box_2d")
        conf = item.get("confidence", None)

        if not label or not isinstance(box, list) or len(box) != 4:
            continue
        try:
            y0 = int(round(float(box[0])))  # type: ignore
            x0 = int(round(float(box[1])))  # type: ignore
            y1 = int(round(float(box[2])))  # type: ignore
            x1 = int(round(float(box[3])))  # type: ignore
        except Exception:
            continue
        if any(v < 0 or v > 1000 for v in (y0, x0, y1, x1)):
            continue

        confidence = None
        if conf is not None:
            try:
                confidence = float(conf)
            except Exception:
                confidence = None

        dets.append(Detection(label=label, box_2d=(y0, x0, y1, x1), confidence=confidence))
    return dets

def detect_with_gemini(pil_image: Image.Image, model: str) -> List[Detection]:
    require_api_key()
    client = genai.Client()

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )

    resp = client.models.generate_content(
        model=model,
        contents=[pil_image, DETECTION_PROMPT],
        config=config,
    )

    if not resp or not getattr(resp, "text", None):
        return []
    return parse_detections(resp.text)

# -------------------------
# "Where is it?" memory
# -------------------------
@dataclass
class TrackedItem:
    label: str
    last_seen_ts: str
    bbox_xyxy: Tuple[int, int, int, int]
    location_phrase: str
    confidence: Optional[float] = None


# In-memory store (simple MVP)
OBJECT_MEMORY: Dict[str, TrackedItem] = {}
ALERTS: List[Dict[str, Any]] = []

# Alert gating
PERSON_PRESENT = False
LAST_PERSON_ALERT_TIME = 0.0
ALERT_COOLDOWN_SEC = float(os.getenv("ALERT_COOLDOWN_SEC", "10"))  # avoid spamming caretaker


def location_phrase_from_bbox(x0: int, y0: int, x1: int, y1: int, w: int, h: int) -> str:
    """Convert bbox center into a simple 3x3 grid phrase."""
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0

    # Horizontal
    if cx < w / 3:
        horiz = "left"
    elif cx < 2 * w / 3:
        horiz = "center"
    else:
        horiz = "right"

    # Vertical
    if cy < h / 3:
        vert = "top"
    elif cy < 2 * h / 3:
        vert = "middle"
    else:
        vert = "bottom"

    return f"{vert}-{horiz}"

def update_object_memory(dets: List[Detection], width: int, height: int) -> None:
    best: Dict[str, Detection] = {}
    for d in dets:
        if d.label == "person":
            continue
        prev = best.get(d.label)
        if prev is None:
            best[d.label] = d
        else:
            if (d.confidence or 0.0) > (prev.confidence or 0.0):
                best[d.label] = d

    for label, d in best.items():
        x0, y0, x1, y1 = d.to_abs_xyxy(width=width, height=height)
        phrase = location_phrase_from_bbox(x0, y0, x1, y1, width, height)
        OBJECT_MEMORY[label] = TrackedItem(
            label=label,
            last_seen_ts=utc_iso(),
            bbox_xyxy=(x0, y0, x1, y1),
            location_phrase=phrase,
            confidence=d.confidence,
        )

def push_alert(kind: str, message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    payload = {
        "id": str(uuid.uuid4()),
        "ts": utc_iso(),
        "kind": kind,
        "message": message,
        "extra": extra or {},
    }
    ALERTS.append(payload)

    max_alerts = int(os.getenv("MAX_ALERTS", "200"))
    while len(ALERTS) > max_alerts:
        ALERTS.pop(0)

def handle_person_alert(dets: List[Detection]) -> Optional[Dict[str, Any]]:
    global PERSON_PRESENT, LAST_PERSON_ALERT_TIME

    has_person = any(d.label == "person" for d in dets)
    now = time.time()

    if has_person and not PERSON_PRESENT:
        PERSON_PRESENT = True
        LAST_PERSON_ALERT_TIME = now
        msg = "🚨 Unknown person detected"
        push_alert(kind="UNKNOWN_PERSON", message=msg)
        return ALERTS[-1]

    if has_person and PERSON_PRESENT and (now - LAST_PERSON_ALERT_TIME) >= ALERT_COOLDOWN_SEC:
        LAST_PERSON_ALERT_TIME = now
        msg = "🚨 Unknown person still present"
        push_alert(kind="UNKNOWN_PERSON_STILL", message=msg)
        return ALERTS[-1]

    if (not has_person) and PERSON_PRESENT:
        PERSON_PRESENT = False

    return None

def pil_from_request(req: Any) -> Image.Image:
    if "image" not in req.files:
        raise ValueError("Missing file field 'image' (multipart/form-data).")
    img_bytes = req.files["image"].read()
    return Image.open(io.BytesIO(img_bytes)).convert("RGB")

# -------------------------
# API Endpoints
# -------------------------
@detect_bp.get("/alerts")
def api_alerts():
    limit = int(request.args.get("limit", "50"))
    alerts_limited = [a for i, a in enumerate(reversed(ALERTS)) if i < limit]
    return jsonify({"alerts": alerts_limited}), 200

@detect_bp.get("/memory")
def api_memory():
    out = {k: asdict(v) for k, v in OBJECT_MEMORY.items()} # type: ignore
    return jsonify({"memory": out}), 200

@detect_bp.get("/where")
def api_where():
    item = (request.args.get("item") or "").strip().lower()
    if not item:
        return jsonify({"error": "Provide ?item=label"}), 400

    tracked = OBJECT_MEMORY.get(item)
    if not tracked:
        return jsonify({"found": False, "item": item, "message": f"I haven't seen {item} yet."}), 200

    x0, y0, x1, y1 = tracked.bbox_xyxy
    return jsonify({
        "found": True,
        "item": item,
        "last_seen_ts": tracked.last_seen_ts,
        "location_phrase": tracked.location_phrase,
        "bbox_xyxy": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
        "announcement": f"Your {item} is in the {tracked.location_phrase.replace('-', ' ')} area.",
    }), 200

@detect_bp.post("/detect")
def api_detect():
    model = (request.args.get("model") or os.getenv("GEMINI_MODEL") or "gemini-3-flash-preview").strip()

    try:
        pil = pil_from_request(request)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    w, h = pil.size
    t0 = time.time()

    try:
        dets = detect_with_gemini(pil, model=model)
    except Exception as e:
        logger.exception("Gemini detection failed")
        return jsonify({"error": f"Detection failed: {e}"}), 500

    latency_ms = int((time.time() - t0) * 1000)
    update_object_memory(dets, width=w, height=h)
    alert = handle_person_alert(dets)

    det_out: List[Dict[str, Any]] = []
    for d in dets:
        x0, y0, x1, y1 = d.to_abs_xyxy(width=w, height=h)
        det_out.append({
            "label": d.label,
            "confidence": d.confidence,
            "bbox_xyxy": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
            "location_phrase": location_phrase_from_bbox(x0, y0, x1, y1, w, h),
        })

    announcements: List[str] = []
    if alert:
        announcements.append(alert["message"])

    for key in ("sunglasses", "glasses", "phone", "keys"):
        if key in OBJECT_MEMORY:
            tracked = OBJECT_MEMORY[key]
            announcements.append(f"Your {key} is in the {tracked.location_phrase.replace('-', ' ')} area.")

    return jsonify({
        "ts": utc_iso(),
        "model": model,
        "latency_ms": latency_ms,
        "image": {"width": w, "height": h},
        "detections": det_out,
        "memory": {k: asdict(v) for k, v in OBJECT_MEMORY.items()}, # type: ignore
        "alert": alert,
        "announcements": announcements,
    }), 200
