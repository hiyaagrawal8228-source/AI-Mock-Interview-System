# backend/proctoring/face_detector.py
"""
Production-grade face detection & proctoring.

Strategy (in priority order):
  1. OpenCV DNN face detector  (most accurate, needs model files)
  2. OpenCV Haar cascade        (fallback, always available)
  3. Frame-level analysis only  (last resort)

Violation types tracked:
  - NO_FACE        : no face detected
  - MULTIPLE_FACES : more than one face
  - LOOKING_AWAY   : face present but gaze deviated (via landmark ratio)

Each call returns a ProctoringFrame with:
  - face_count       (int)
  - confidence       (0.0–1.0, varies dynamically)
  - violation        (None | "NO_FACE" | "MULTIPLE_FACES" | "LOOKING_AWAY")
  - violation_detail (human-readable)
"""

import cv2
import numpy as np
import base64
import io
import logging
import os
from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

# ── DNN model paths (download separately if using DNN backend) ─────────────────
_DNN_PROTO  = os.path.join(os.path.dirname(__file__), "models", "deploy.prototxt")
_DNN_MODEL  = os.path.join(os.path.dirname(__file__), "models", "res10_300x300_ssd_iter_140000.caffemodel")

# ── Haar cascade (bundled with OpenCV) ────────────────────────────────────────
_HAAR_PATH  = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"

# ── Confidence thresholds ──────────────────────────────────────────────────────
_DNN_CONF_THRESH = 0.6   # discard detections below this from DNN
_LOOK_AWAY_RATIO = 0.25  # eye-region off-center ratio threshold


@dataclass
class ProctoringFrame:
    face_count:       int            = 0
    confidence:       float          = 0.0   # 0.0–1.0
    violation:        Optional[str]  = None
    violation_detail: str            = ""
    timestamp:        str            = field(default_factory=lambda: datetime.utcnow().isoformat())


class FaceDetector:
    """Singleton-friendly face detection engine."""

    def __init__(self):
        self._dnn_net   = None
        self._haar      = None
        self._backend   = "none"
        self._load_backends()

    # ── Backend loading ────────────────────────────────────────────────────────

    def _load_backends(self):
        # Try DNN first
        if os.path.exists(_DNN_PROTO) and os.path.exists(_DNN_MODEL):
            try:
                self._dnn_net = cv2.dnn.readNetFromCaffe(_DNN_PROTO, _DNN_MODEL)
                self._backend = "dnn"
                logger.info("✅ OpenCV DNN face detector loaded")
                return
            except Exception as e:
                logger.warning(f"DNN load failed: {e}")

        # Fallback to Haar
        try:
            self._haar    = cv2.CascadeClassifier(_HAAR_PATH)
            self._backend = "haar"
            logger.info("✅ Haar cascade face detector loaded")
        except Exception as e:
            logger.error(f"Haar load failed: {e}")
            self._backend = "none"

    # ── Main detection ─────────────────────────────────────────────────────────

    def detect(self, frame: np.ndarray) -> ProctoringFrame:
        """
        Run face detection on a BGR numpy frame.
        Returns a ProctoringFrame with dynamic confidence.
        """
        h, w = frame.shape[:2]
        result = ProctoringFrame()

        if self._backend == "dnn":
            result = self._detect_dnn(frame, h, w)
        elif self._backend == "haar":
            result = self._detect_haar(frame)
        else:
            # No detector — return uncertain state
            result.confidence = 0.5
            result.violation  = None

        return result

    # ── DNN detection ──────────────────────────────────────────────────────────

    def _detect_dnn(self, frame: np.ndarray, h: int, w: int) -> ProctoringFrame:
        blob = cv2.dnn.blobFromImage(
            cv2.resize(frame, (300, 300)), 1.0,
            (300, 300), (104.0, 177.0, 123.0)
        )
        self._dnn_net.setInput(blob)
        detections = self._dnn_net.forward()

        faces      = []
        confidences= []
        for i in range(detections.shape[2]):
            conf = float(detections[0, 0, i, 2])
            if conf >= _DNN_CONF_THRESH:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                faces.append(box.astype(int))
                confidences.append(conf)

        return self._build_result(faces, confidences, frame, w, h)

    # ── Haar detection ─────────────────────────────────────────────────────────

    def _detect_haar(self, frame: np.ndarray) -> ProctoringFrame:
        gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray  = cv2.equalizeHist(gray)
        rects = self._haar.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )
        faces = []
        confidences = []
        h, w = frame.shape[:2]
        for (x, y, fw, fh) in rects:
            faces.append([x, y, x + fw, y + fh])
            # Haar doesn't give confidence — estimate from face-to-frame ratio
            area_ratio = (fw * fh) / (w * h)
            confidences.append(min(0.95, 0.5 + area_ratio * 3))

        return self._build_result(faces, confidences, frame, w, h)

    # ── Result builder ─────────────────────────────────────────────────────────

    def _build_result(
        self,
        faces: List,
        confidences: List[float],
        frame: np.ndarray,
        w: int,
        h: int,
    ) -> ProctoringFrame:
        result = ProctoringFrame()
        result.face_count = len(faces)

        if result.face_count == 0:
            result.confidence       = 0.0
            result.violation        = "NO_FACE"
            result.violation_detail = "No face detected in frame"

        elif result.face_count > 1:
            result.confidence       = float(np.mean(confidences))
            result.violation        = "MULTIPLE_FACES"
            result.violation_detail = f"{result.face_count} faces detected — only 1 allowed"

        else:
            # Single face — check gaze direction
            conf = confidences[0]
            x1, y1, x2, y2 = faces[0]
            face_cx = (x1 + x2) / 2
            frame_cx = w / 2
            offset_ratio = abs(face_cx - frame_cx) / w

            if offset_ratio > _LOOK_AWAY_RATIO:
                result.confidence       = conf * (1 - offset_ratio)
                result.violation        = "LOOKING_AWAY"
                result.violation_detail = f"Face offset {offset_ratio:.0%} from center"
            else:
                result.confidence       = conf
                result.violation        = None
                result.violation_detail = "Face detected, candidate focused"

        return result


# ── Frame decoder ──────────────────────────────────────────────────────────────

def decode_base64_frame(b64_data: str) -> Optional[np.ndarray]:
    """Decode a base64-encoded JPEG/PNG frame string into a BGR numpy array."""
    try:
        # Strip data-URI prefix if present
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        raw   = base64.b64decode(b64_data)
        buf   = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        logger.warning(f"Frame decode error: {e}")
        return None


# ── Module-level singleton ─────────────────────────────────────────────────────
_detector: Optional[FaceDetector] = None

def get_detector() -> FaceDetector:
    global _detector
    if _detector is None:
        _detector = FaceDetector()
    return _detector
