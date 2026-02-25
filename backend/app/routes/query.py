"""
Elder query endpoint — the heart of the memory retrieval system.

Flow per spec:
  1. Receive elder's voice-transcribed query
  2. Use Gemini ONLY to classify intent + extract entity
  3. Run DETERMINISTIC SQL retrieval (no AI)
  4. Use Gemini ONLY to narrate retrieved memory (context-only, no invention)
  5. Log interaction
  6. Return structured response

The LLM is NEVER the source of truth.
"""
import json
import os
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import base64
from app.extensions import db, eleven_client
from app.models import (
    Memory, MemoryPerson, MemoryMedicine, MemoryRoutine,
    MemoryEvent, MemoryObject, MemoryReassurance,
    InteractionLog, Reminder
)

query_bp = Blueprint("query", __name__, url_prefix="/api/query")

FALLBACK_NEPALI = "मलाई जानकारी छैन। के फोन गरिदिउँ?"


# ═══════════════════════════════════════════
# 1. INTENT CLASSIFICATION  (Gemini — output only JSON)
# ═══════════════════════════════════════════

INTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {
            "type": "string",
            "enum": [
                "person_query", "medicine_query", "routine_query",
                "event_query", "object_query", "reassurance_query",
                "emergency", "unknown"
            ]
        },
        "entity": {"type": "string"}
    },
    "required": ["intent", "entity"]
}

INTENT_PROMPT = """\
You classify the intent of an elderly person's spoken question.
Return ONLY JSON with two fields:
- "intent": one of [person_query, medicine_query, routine_query, event_query, object_query, reassurance_query, emergency, unknown]
- "entity": the main subject noun (person name, medicine name, object name, etc.) or "" if not applicable

Examples:
  "मेरो छोरो कहाँ छ?" → {"intent":"event_query","entity":"छोरो"}
  "राम कहाँ छ?" → {"intent":"event_query","entity":"राम"}
  "चश्मा कहाँ छ?" → {"intent":"object_query","entity":"चश्मा"}
  "यो औषधि किन खाने?" → {"intent":"medicine_query","entity":"औषधि"}
  "मलाई डर लागिरहेछ" → {"intent":"reassurance_query","entity":""}
  "मद्दत चाहियो" → {"intent":"emergency","entity":""}
  "बिहान के गर्ने?" → {"intent":"routine_query","entity":""}

Now classify:
"""

def _classify_intent(text: str) -> dict:
    """Returns {"intent": ..., "entity": ...} or falls back to unknown."""
    import re
    try:
        from google import genai
        from google.genai import types

        api_key = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"')
        if not api_key:
            return {"intent": "unknown", "entity": ""}

        client = genai.Client(api_key=api_key)
        model  = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

        # Do NOT use response_mime_type="application/json" with gemini-2.5-flash
        # — it causes thinking-mode truncation. Use plain text and extract JSON.
        resp = client.models.generate_content(
            model=model,
            contents=INTENT_PROMPT + f'"{text}" (Return result as raw JSON only, no markdown blocks)',
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=500,
            ),
        )
        raw = (resp.text or "").strip()
        print(f"DEBUG: Gemini raw intent response: {repr(raw)}")
        
        # Extract first JSON object from the response (handles markdown wrappers too)
        json_str = raw
        if "```json" in raw:
            json_str = raw.split("```json")[-1].split("```")[0].strip()
        elif "{" in raw:
            json_str = "{" + raw.split("{", 1)[1].rsplit("}", 1)[0] + "}"
        
        try:
            res = json.loads(json_str)
            return res
        except:
            # Fallback regex if split fails
            match = re.search(r'\{[^}]+\}', raw, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        
        return {"intent": "unknown", "entity": "", "raw_debug": raw}
    except Exception as e:
        print(f"Intent error: {e}")
        return {"intent": "unknown", "entity": "", "raw_debug": str(e)}


# ═══════════════════════════════════════════
# 2. DETERMINISTIC RETRIEVAL  (pure SQL, no AI)
# ═══════════════════════════════════════════

def _retrieve_memory(elder_id: int, intent: str, entity: str) -> dict | None:
    """
    Returns the most relevant memory record as a plain dict,
    or None if nothing is found.
    """
    now = datetime.now(timezone.utc)
    entity_lc = (entity or "").strip().lower()

    # ── person_query ────────────────────────────────────────
    if intent == "person_query":
        q = db.session.query(MemoryPerson)\
            .join(Memory, Memory.id == MemoryPerson.memory_id)\
            .filter(Memory.elder_id == elder_id, Memory.type == "person")
        if entity_lc:
            q = q.filter(
                db.func.lower(MemoryPerson.name).contains(entity_lc) |
                db.func.lower(MemoryPerson.relationship).contains(entity_lc)
            )
        ext = q.order_by(Memory.created_at.desc()).first()
        if ext:
            return {
                "type":         "person",
                "name":         ext.name,
                "relationship": ext.relationship,
                "phone":        ext.phone,
                "photo_url":    ext.photo_url,
            }

    # ── event_query (MOST IMPORTANT: get latest valid event) ─
    elif intent == "event_query":
        q = db.session.query(MemoryEvent)\
            .join(Memory, Memory.id == MemoryEvent.memory_id)\
            .filter(Memory.elder_id == elder_id, Memory.type == "event")\
            .filter(
                (MemoryEvent.effective_from == None) | (MemoryEvent.effective_from <= now)
            )\
            .filter(
                (MemoryEvent.effective_to == None) | (MemoryEvent.effective_to > now)
            )
        if entity_lc:
            q = q.filter(
                db.func.lower(MemoryEvent.related_person).contains(entity_lc) |
                db.func.lower(MemoryEvent.message).contains(entity_lc)
            )
        ext = q.order_by(Memory.created_at.desc()).first()
        if ext:
            return {
                "type":           "event",
                "related_person": ext.related_person,
                "message":        ext.message,
                "photo_url":      ext.photo_url,
            }

    # ── medicine_query ───────────────────────────────────────
    elif intent == "medicine_query":
        q = db.session.query(MemoryMedicine)\
            .join(Memory, Memory.id == MemoryMedicine.memory_id)\
            .filter(Memory.elder_id == elder_id, Memory.type == "medicine")
        if entity_lc:
            q = q.filter(db.func.lower(MemoryMedicine.name).contains(entity_lc))
        ext = q.order_by(Memory.created_at.desc()).first()
        if ext:
            return {
                "type":   "medicine",
                "name":   ext.name,
                "dosage": ext.dosage,
                "reason": ext.reason,
            }

    # ── routine_query ────────────────────────────────────────
    elif intent == "routine_query":
        routines = db.session.query(MemoryRoutine)\
            .join(Memory, Memory.id == MemoryRoutine.memory_id)\
            .filter(Memory.elder_id == elder_id, Memory.type == "routine")\
            .order_by(MemoryRoutine.time_of_day.asc()).all()
        if routines:
            lines = [f"• {r.time_of_day or ''}: {r.description or ''}" for r in routines]
            return {"type": "routine", "summary": "\n".join(lines)}

    # ── object_query ─────────────────────────────────────────
    elif intent == "object_query":
        q = db.session.query(MemoryObject)\
            .join(Memory, Memory.id == MemoryObject.memory_id)\
            .filter(Memory.elder_id == elder_id, Memory.type == "object")
        if entity_lc:
            q = q.filter(db.func.lower(MemoryObject.object_name).contains(entity_lc))
        ext = q.order_by(Memory.created_at.desc()).first()
        if ext:
            return {
                "type":           "object",
                "object_name":    ext.object_name,
                "usual_location": ext.usual_location,
                "photo_url":      ext.photo_url,
            }

    # ── reassurance_query ────────────────────────────────────
    elif intent == "reassurance_query":
        ext = db.session.query(MemoryReassurance)\
            .join(Memory, Memory.id == MemoryReassurance.memory_id)\
            .filter(Memory.elder_id == elder_id, Memory.type == "reassurance")\
            .order_by(Memory.created_at.desc()).first()
        if ext:
            return {
                "type":    "reassurance",
                "message": ext.message,
            }

    return None


# ═══════════════════════════════════════════
# 3. NARRATION  (Gemini — context-only, strict)
# ═══════════════════════════════════════════

NARRATE_SYSTEM = """\
तपाईं एउटा मेमोरी सहायक हुनुहुन्छ जसले वृद्ध व्यक्तिलाई सहयोग गर्छ।
नियम:
- तलको MEMORY DATA मा भएको जानकारी मात्र प्रयोग गर्नुहोस्।
- अनुमान नगर्नुहोस्। थप्नुहोस् पनि।
- जवाफ छोटो, सरल नेपालीमा दिनुहोस् (२–३ वाक्य मात्र)।
- "हजुर" वा "हजुरआमा" भनेर सम्बोधन गर्नुहोस्।
- MEMORY DATA खाली भए: "मलाई जानकारी छैन। के फोन गरिदिउँ?" मात्र भन्नुहोस्।
"""

def _narrate(question: str, memory: dict | None) -> str:
    """Ask Gemini to convert retrieved memory into spoken Nepali. Never guesses."""
    if not memory:
        return FALLBACK_NEPALI

    memory_text = json.dumps(memory, ensure_ascii=False, indent=2)

    try:
        from google import genai
        from google.genai import types

        api_key = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"')
        if not api_key:
            return _simple_narrate(memory)

        client = genai.Client(api_key=api_key)
        model  = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

        prompt = (
            f"MEMORY DATA:\n{memory_text}\n\n"
            f"प्रश्न: {question}\n\n"
            "अब MEMORY DATA आधारमा मात्र छोटो उत्तर दिनुहोस्:"
        )

        resp = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=NARRATE_SYSTEM,
                temperature=0.2,
                max_output_tokens=500,
            ),
        )
        answer = (resp.text or "").strip()
        return answer if answer else _simple_narrate(memory)

    except Exception as e:
        print(f"Narrate error: {e}")
        return _simple_narrate(memory)


def _simple_narrate(memory: dict) -> str:
    """Deterministic fallback narration — no AI needed."""
    mtype = memory.get("type", "")
    if mtype == "person":
        name = memory.get("name", "")
        rel  = memory.get("relationship", "")
        ph   = memory.get("phone", "")
        return f"हजुर, {rel} {name}। फोन: {ph}।" if ph else f"हजुर, {rel} {name}।"
    elif mtype == "event":
        return f"हजुर, {memory.get('message', '')}।"
    elif mtype == "medicine":
        return f"हजुर, {memory.get('name', '')}। {memory.get('reason', '')}।"
    elif mtype == "routine":
        return f"हजुर, दिनचर्या:\n{memory.get('summary', '')}।"
    elif mtype == "object":
        return f"हजुर, {memory.get('object_name', '')} {memory.get('usual_location', '')}मा छ।"
    elif mtype == "reassurance":
        return memory.get("message", FALLBACK_NEPALI)
    return FALLBACK_NEPALI


# ═══════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════
NEPALI_VOICE_ID = os.getenv("ELEVEN_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")


@query_bp.post("")
@jwt_required(optional=True)
def handle_query():
    """
    Elder asks a question (voice-transcribed text).
    Returns a Nepali answer narrated from stored memory only.
    """
    data     = request.get_json(silent=True) or {}
    text     = (data.get("text") or "").strip()
    elder_id = data.get("elder_id")

    # Try to get elder_id from JWT if not provided
    if not elder_id:
        try:
            elder_id = int(get_jwt_identity() or 0) or None
        except Exception:
            elder_id = None

    if not text:
        return jsonify({"error": "text is required"}), 400
    if not elder_id:
        return jsonify({"error": "elder_id required"}), 400

    elder_id = int(elder_id)

    # ── Step 1: classify intent ──────────────────────────────
    intent_result = _classify_intent(text)
    print(f"DEBUG: Intent result: {intent_result}")
    intent = intent_result.get("intent", "unknown")
    entity = intent_result.get("entity", "")
    debug_raw = intent_result.get("raw_debug") # We will add this in _classify_intent

    # ── Step 2: handle emergency immediately (no AI) ─────────
    if intent == "emergency":
        # Log and return emergency response
        log = InteractionLog(
            elder_id=elder_id, intent="emergency",
            raw_query=text, response_type="emergency", confidence=1.0
        )
        db.session.add(log)
        db.session.commit()
        return jsonify({
            "answer_nepali":  "मद्दत बोलाइँदैछ! (Calling for help!)",
            "intent":         "emergency",
            "entity":         entity,
            "memory_used":    None,
            "response_type":  "emergency",
        })

    # ── Step 3: deterministic retrieval ─────────────────────
    memory = _retrieve_memory(elder_id, intent, entity)

    # ── Step 4: narrate via Gemini (context-only) ────────────
    response_type = "memory" if memory else "fallback"
    answer = _narrate(text, memory)
    # ── Step 5: Convert Text to Nepali Audio (ElevenLabs) ────
    audio_base64 = ""
    try:
        # We use the Multilingual v2 model for the best Nepali support
        audio_generator = eleven_client.text_to_speech.convert(
            voice_id=NEPALI_VOICE_ID,
            model_id="eleven_v3", 
            text=answer,
            output_format="mp3_44100_128"
        )
        
        # Convert the generator/bytes into base64
        audio_bytes = b"".join(audio_generator)
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
    except Exception as e:
        print(f"ElevenLabs Error: {e}") 
    
    # ── Step 5: log interaction ──────────────────────────────
    log = InteractionLog(
        elder_id      = elder_id,
        intent        = intent,
        raw_query     = text,
        response_type = response_type,
        confidence    = 1.0 if memory else 0.0,
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "answer_nepali": answer,
        "audio_content": audio_base64,
        "intent":        intent,
        "entity":        entity,
        "memory_used":   memory,
        "response_type": response_type,
    })


@query_bp.get("/sync/<int:elder_id>")
@jwt_required()
def sync_offline_cache(elder_id):
    """
    Returns a compact JSON of all active memories for offline caching
    on the elder's device. Only essential fields included to minimize size.
    """
    memories = Memory.query.filter_by(elder_id=elder_id).all()
    reminders = Reminder.query.filter_by(elder_id=elder_id, active=True).all()

    mem_list = []
    for m in memories:
        entry = {"id": m.id, "type": m.type, "title": m.title}
        if m.type == "person":
            ext = MemoryPerson.query.filter_by(memory_id=m.id).first()
            if ext:
                entry.update({"name": ext.name, "phone": ext.phone, "relationship": ext.relationship})
        elif m.type == "event":
            ext = MemoryEvent.query.filter_by(memory_id=m.id).first()
            if ext:
                entry.update({"message": ext.message, "related_person": ext.related_person})
        elif m.type == "object":
            ext = MemoryObject.query.filter_by(memory_id=m.id).first()
            if ext:
                entry.update({"object_name": ext.object_name, "usual_location": ext.usual_location})
        elif m.type == "reassurance":
            ext = MemoryReassurance.query.filter_by(memory_id=m.id).first()
            if ext:
                entry.update({"message": ext.message})
        mem_list.append(entry)

    return jsonify({
        "elder_id":  elder_id,
        "memories":  mem_list,
        "reminders": [
            {"id": r.id, "title": r.title, "body": r.body,
             "scheduled_time": r.scheduled_time, "repeat_pattern": r.repeat_pattern}
            for r in reminders
        ],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    })


@query_bp.get("/logs/<int:elder_id>")
@jwt_required()
def get_logs(elder_id):
    """Caregiver views recent interaction logs for an elder."""
    limit  = min(int(request.args.get("limit", 50)), 200)
    logs   = InteractionLog.query.filter_by(elder_id=elder_id)\
        .order_by(InteractionLog.timestamp.desc()).limit(limit).all()
    return jsonify({
        "elder_id": elder_id,
        "logs": [
            {
                "id":            l.id,
                "intent":        l.intent,
                "raw_query":     l.raw_query,
                "response_type": l.response_type,
                "confidence":    l.confidence,
                "timestamp":     l.timestamp.isoformat(),
            }
            for l in logs
        ],
    })
