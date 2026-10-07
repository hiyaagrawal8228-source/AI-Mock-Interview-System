# backend/confidence_utils.py
"""
Audio confidence scoring using librosa.
Handles librosa API changes across versions gracefully.
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)


def get_confidence_score(audio_path: str) -> float:
    """
    Estimate speaker confidence from audio features:
    - RMS energy  (loudness / vocal presence)
    - Tempo       (speech rate)
    - ZCR         (articulatory clarity)

    Returns float in [0.0, 1.0]
    """
    try:
        import librosa

        y, sr = librosa.load(audio_path, sr=16000)
        duration = librosa.get_duration(y=y, sr=sr)

        if duration < 1.0:
            return 0.2

        # RMS energy
        rms = float(np.mean(librosa.feature.rms(y=y)))

        # Tempo — handle API change: newer librosa returns scalar from beat_track
        try:
            tempo_result = librosa.beat.beat_track(y=y, sr=sr)
            # Handle both (tempo, beats) tuple and newer scalar return
            if isinstance(tempo_result, tuple):
                tempo = float(np.atleast_1d(tempo_result[0])[0])
            else:
                tempo = float(np.atleast_1d(tempo_result)[0])
        except Exception:
            tempo = 120.0  # safe fallback

        # Zero crossing rate
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        # Normalise to [0, 1]
        rms_score   = min(rms * 100, 1.0)
        tempo_score = min(tempo / 150.0, 1.0)
        zcr_score   = min(zcr * 10, 1.0)

        confidence = 0.4 * rms_score + 0.3 * tempo_score + 0.3 * zcr_score
        return round(float(np.clip(confidence, 0.0, 1.0)), 3)

    except ImportError:
        logger.warning("librosa not available — returning default confidence")
        return 0.5
    except Exception as e:
        logger.warning(f"Confidence scoring error: {e}")
        return 0.5
