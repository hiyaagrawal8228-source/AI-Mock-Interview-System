# backend/speech_to_text.py

import os
import logging
from groq import Groq

logger = logging.getLogger(__name__)

client = Groq(api_key=os.getenv("DEFAULT_GROQ_API_KEY"))


def transcribe(audio_path: str) -> str:
    """
    Transcribe audio using Groq Whisper API (NO ffmpeg required)
    Supports webm, wav, mp3 directly
    """
    try:
        with open(audio_path, "rb") as f:
            response = client.audio.transcriptions.create(
                file=f,
                model="whisper-large-v3"
            )

        text = response.text.strip() if response.text else ""
        return text

    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return ""