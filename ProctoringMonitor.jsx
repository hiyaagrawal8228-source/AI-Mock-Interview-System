// frontend/src/components/proctoring/ProctoringMonitor.jsx
/**
 * ProctoringMonitor
 * - Captures webcam frames every 3 seconds
 * - Sends base64 frame to /api/proctor/frame
 * - Displays real-time face detection result (face count, confidence, violations)
 * - Tracks violation log in parent via onViolation callback
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, EyeOff, AlertTriangle, CheckCircle, Users } from "lucide-react";
import { analyzeFrame } from "@/lib/api";

const FRAME_INTERVAL_MS = 3000; // capture every 3s

const VIOLATION_LABELS = {
  NO_FACE:        { label: "No Face Detected",    icon: EyeOff,       color: "text-red-400",    bg: "bg-red-400/10"    },
  MULTIPLE_FACES: { label: "Multiple Faces",       icon: Users,        color: "text-orange-400", bg: "bg-orange-400/10" },
  LOOKING_AWAY:   { label: "Looking Away",         icon: AlertTriangle,color: "text-yellow-400", bg: "bg-yellow-400/10" },
};

export default function ProctoringMonitor({ interviewId, videoRef, onViolation }) {
  const canvasRef       = useRef(null);
  const intervalRef     = useRef(null);
  const [status, setStatus] = useState({
    face_count:       0,
    confidence:       0,
    violation:        null,
    violation_detail: "",
  });
  const [violationCount, setViolationCount] = useState(0);
  const [capturing, setCapturing]           = useState(false);

  const captureAndAnalyze = useCallback(async () => {
    const video  = videoRef?.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !interviewId) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    // Draw frame to canvas
    canvas.width  = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, 320, 240);
    const b64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

    try {
      setCapturing(true);
      const result = await analyzeFrame({ interview_id: interviewId, frame_b64: b64 });
      setStatus(result);
      if (result.violation) {
        setViolationCount((c) => c + 1);
        onViolation?.(result.violation, result.violation_detail);
      }
    } catch {
      // silently ignore network errors during proctoring
    } finally {
      setCapturing(false);
    }
  }, [interviewId, videoRef, onViolation]);

  useEffect(() => {
    intervalRef.current = setInterval(captureAndAnalyze, FRAME_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [captureAndAnalyze]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const violation     = status.violation;
  const violationMeta = violation ? VIOLATION_LABELS[violation] : null;
  const conf          = Math.round(status.confidence * 100);

  return (
    <>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Status badge */}
      <div className="space-y-2">
        {/* Face status */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            violation
              ? `${violationMeta?.bg} ${violationMeta?.color}`
              : "bg-emerald-400/10 text-emerald-400"
          }`}
        >
          {violation ? (
            <>
              {violationMeta && <violationMeta.icon className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{violationMeta?.label}</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Face Detected</span>
            </>
          )}

          {/* Confidence bar */}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  conf >= 70 ? "bg-emerald-400" : conf >= 40 ? "bg-yellow-400" : "bg-red-400"
                }`}
                style={{ width: `${conf}%` }}
              />
            </div>
            <span className="text-[10px] opacity-70">{conf}%</span>
          </div>
        </div>

        {/* Violation count */}
        {violationCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-orange-400/80">
            <AlertTriangle className="w-3 h-3" />
            <span>{violationCount} proctoring alert{violationCount !== 1 ? "s" : ""} logged</span>
          </div>
        )}

        {/* Detail message */}
        {status.violation_detail && !violation && (
          <p className="text-xs text-muted-foreground">{status.violation_detail}</p>
        )}
      </div>
    </>
  );
}
