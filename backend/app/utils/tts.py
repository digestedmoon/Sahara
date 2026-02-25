import os
import base64
from app.extensions import eleven_client

NEPALI_VOICE_ID = os.getenv("ELEVEN_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")

def generate_tts_base64(text: str) -> str:
    """
    Takes Nepali text and converts it to a base64 encoded MP3 audio string 
    using ElevenLabs Multilingual v2 model.
    """
    if not text:
        return ""
        
    try:
        audio_generator = eleven_client.text_to_speech.convert(
            voice_id=NEPALI_VOICE_ID,
            model_id="eleven_v3", 
            text=text,
            output_format="mp3_44100_128"
        )
        audio_bytes = b"".join(audio_generator)
        return base64.b64encode(audio_bytes).decode('utf-8')
    except Exception as e:
        print(f"ElevenLabs TTS Error: {e}")
        return ""
