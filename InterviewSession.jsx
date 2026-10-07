// frontend/src/pages/InterviewSession.jsx
/**
 * InterviewSession — Production rewrite
 *
 * ✅ Fixed: text answers validated + submitted via /api/interview/answer/text
 * ✅ Fixed: voice answers transcribed via /api/interview/answer/voice
 * ✅ Fixed: real proctoring via ProctoringMonitor (backend face detection)
 * ✅ Fixed: interview_id tracked throughout; endInterview() called on finish
 * ✅ Fixed: per-answer evaluation displayed inline
 * ✅ Fixed: recording indicator with waveform animation
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate }   from "react-router-dom";
import { Mic, MicOff, Send, Square, BarChart2, CheckCircle2, AlertTriangle } from "lucide-react";
import toast             from "react-hot-toast";
import { submitTextAnswer, submitVoiceAnswer, endInterview } from "@/lib/api";
import { formatDuration, scoreColor }  from "@/lib/utils";
import useInterviewStore from "@/store/useInterviewStore";
import { ROUTES }        from "@/lib/constants";
import LoadingSpinner    from "@/components/common/LoadingSpinner";
import ProctoringMonitor from "@/components/proctoring/ProctoringMonitor";

// ── Webcam hook ───────────────────────────────────────────────────────────────
function useWebcam(videoRef) {
  const streamRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        // Camera not available — proctoring will log zero-face frames
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
}

// ── Inline per-answer score badge ─────────────────────────────────────────────
function EvalBadge({ evaluation }) {
  if (!evaluation) return null;
  const score = evaluation.score_out_of_10;
  const color = scoreColor(score * 10);
  return (
    <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="font-bold" style={{ color }}>{score}/10</span>
      {evaluation.strength && (
        <span className="text-emerald-400/80 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> {evaluation.strength}
        </span>
      )}
      {evaluation.improvement && (
        <span className="text-yellow-400/80 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {evaluation.improvement}
        </span>
      )}
    </div>
  );
}

// ── Recording waveform ─────────────────────────────────────────────────────────
function RecordingWave() {
  return (
    <span className="flex items-end gap-0.5 h-4" aria-label="Recording">
      {[1, 3, 2, 4, 1.5].map((h, i) => (
        <span
          key={i}
          className="w-0.5 bg-red-400 rounded-full animate-bounce"
          style={{ height: `${h * 4}px`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InterviewSession() {
  const navigate = useNavigate();
  const {
    sessionConfig,
    interviewId,
    firstQuestion,
    totalQuestions,
    setReportData,
  } = useInterviewStore();

  // Redirect if no active session
  useEffect(() => {
    if (!sessionConfig || !interviewId) {
      navigate(ROUTES.SETUP);
    }
  }, []);

  // ── State ────────────────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState("active"); // active | submitting | ending | done
  const [messages,    setMessages]    = useState([]);
  const [inputText,   setInputText]   = useState("");
  const [qIndex,      setQIndex]      = useState(0);       // 0-based current question index
  const [recording,   setRecording]   = useState(false);
  const [timer,       setTimer]       = useState((sessionConfig?.duration || 10) * 60);
  const [violations,  setViolations]  = useState([]);      // proctoring violations log

  // Refs
  const videoRef   = useRef(null);
  const mediaRef   = useRef(null);
  const chunksRef  = useRef([]);
  const chatEndRef = useRef(null);
  const timerRef   = useRef(null);
  const textRef    = useRef(null);

  useWebcam(videoRef);

  // ── Init: push first question ─────────────────────────────────────────────
  useEffect(() => {
    if (!firstQuestion) return;
    setMessages([{ role: "ai", text: firstQuestion, ts: new Date() }]);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleFinish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [firstQuestion]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Proctoring violation callback ─────────────────────────────────────────
  const onViolation = useCallback((type, detail) => {
    setViolations((v) => [
      ...v,
      { type, detail, ts: new Date().toLocaleTimeString() },
    ]);
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (phase !== "active") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg",
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(250); // collect in 250ms chunks
      mediaRef.current = mr;
      setRecording(true);
      toast("Recording… click Stop to submit", { icon: "🎙️" });
    } catch {
      toast.error("Microphone access denied. Please type your answer instead.");
    }
  };

  const stopAndSubmitVoice = () => {
    if (!mediaRef.current || mediaRef.current.state === "inactive") return;
    setRecording(false);

    mediaRef.current.onstop = async () => {
      const mimeType = mediaRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      mediaRef.current?.stream?.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;

      if (blob.size < 1000) {
        toast.error("Recording too short. Please speak your answer.");
        setPhase("active");
        return;
      }
      await handleSubmit({ audioBlob: blob });
    };

    mediaRef.current.stop();
  };

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async ({ text, audioBlob } = {}) => {
    if (phase !== "active") return;

    const answer = text || inputText;
    if (!audioBlob && !answer?.trim()) {
      toast.error("Please type your answer before submitting.");
      textRef.current?.focus();
      return;
    }

    setPhase("submitting");
    setInputText("");

    // Optimistically add user message
    const userText = text || (audioBlob ? "🎙️ Voice answer (transcribing…)" : answer);
    const userMsg  = { role: "user", text: userText, ts: new Date(), pending: !!audioBlob };
    setMessages((m) => [...m, userMsg]);

    try {
      let res;
      if (audioBlob) {
        res = await submitVoiceAnswer(audioBlob, interviewId, 1.0);
        // Replace pending message with transcription
        setMessages((m) =>
          m.map((msg) =>
            msg.pending
              ? { ...msg, text: res.transcription || userText, pending: false, evaluation: res.evaluation }
              : msg
          )
        );
      } else {
        res = await submitTextAnswer({
          interview_id: interviewId,
          answer_text:  answer.trim(),
          focus_score:  1.0,
        });
        setMessages((m) =>
          m.map((msg) =>
            msg.text === userText && msg.role === "user"
              ? { ...msg, evaluation: res.evaluation }
              : msg
          )
        );
      }

      setQIndex((i) => i + 1);

      if (res.status === "continue" && res.next_question) {
        setMessages((m) => [...m, { role: "ai", text: res.next_question, ts: new Date() }]);
        setPhase("active");
        textRef.current?.focus();
      } else {
        // All questions answered
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            text: "All questions answered! Great job. Click 'End Interview' to see your detailed report.",
            ts: new Date(),
          },
        ]);
        setPhase("active"); // still allow them to click end
      }
    } catch (err) {
      // Remove the optimistic message
      setMessages((m) => m.filter((msg) => !msg.pending));
      const msg = err?.message || "Submission failed. Please try again.";
      toast.error(msg);
      setPhase("active");
    }
  };

  // ── Finish interview ──────────────────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    if (phase === "ending" || phase === "done") return;
    clearInterval(timerRef.current);
    setPhase("ending");

    // Stop any active recording
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }

    setMessages((m) => [
      ...m,
      { role: "ai", text: "Interview ended. Generating your report…", ts: new Date() },
    ]);

    try {
      const report = await endInterview(interviewId);
      setReportData(report);
      setPhase("done");
      navigate(ROUTES.FEEDBACK);
    } catch (err) {
      toast.error(err?.message || "Could not generate report. Please try again.");
      setPhase("active");
    }
  }, [interviewId, phase, navigate, setReportData]);

  const handleTextSubmit = () => handleSubmit({ text: inputText });

  // ── UI helpers ────────────────────────────────────────────────────────────
  const timerColor  = timer < 60 ? "text-red-400" : timer < 300 ? "text-yellow-400" : "text-emerald-400";
  const totalSecs   = (sessionConfig?.duration || 10) * 60;
  const progress    = Math.min(100, ((totalSecs - timer) / totalSecs) * 100);
  const isSubmitting= phase === "submitting" || phase === "ending";
  const total       = totalQuestions || Math.round((sessionConfig?.duration || 10) * 1.5);

  if (!sessionConfig || !interviewId) {
    return <LoadingSpinner fullScreen message="Loading session…" />;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] max-w-7xl mx-auto px-4 gap-4 py-4 overflow-hidden">

      {/* ── Chat area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header bar */}
        <div className="glass rounded-xl px-5 py-3 mb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${
              phase === "done" || phase === "ending"
                ? "bg-emerald-400"
                : recording ? "bg-red-400 animate-pulse" : "bg-red-400"
            }`} />
            <span className="font-bold text-sm">
              {phase === "ending" ? "Generating Report…" : phase === "done" ? "Complete" : "Live Interview"}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
              {sessionConfig.type?.toUpperCase() || "INTERVIEW"}
            </span>
            {recording && (
              <span className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                <RecordingWave /> REC
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-mono font-bold text-sm ${timerColor}`}>
              {formatDuration(timer)}
            </span>
            <span className="text-xs text-muted-foreground">
              {qIndex}/{total}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-muted mb-3 overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-2 pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "ai" ? "justify-start" : "justify-end"} animate-fade-in`}
            >
              {m.role === "ai" ? (
                <div className="max-w-[80%] bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4 relative">
                  <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-primary text-primary-foreground text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                    AI Interviewer
                  </div>
                  <p className="text-sm leading-relaxed">{m.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                    {m.ts.toLocaleTimeString()}
                  </p>
                </div>
              ) : (
                <div className="max-w-[80%] bg-accent/10 border border-accent/20 rounded-2xl rounded-tr-sm px-5 py-4">
                  <p className={`text-sm leading-relaxed ${m.pending ? "opacity-60 italic" : ""}`}>
                    {m.text}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    {m.ts.toLocaleTimeString()}
                  </p>
                  {m.evaluation && <EvalBadge evaluation={m.evaluation} />}
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {phase === "submitting" && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-3">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">Processing…</span>
                </div>
              </div>
            </div>
          )}

          {/* Ending indicator */}
          {phase === "ending" && (
            <div className="text-center py-8 animate-fade-in">
              <div className="text-4xl mb-3">📊</div>
              <p className="font-bold text-primary">Generating your report…</p>
              <p className="text-sm text-muted-foreground mt-1">Evaluating all answers with AI</p>
              <LoadingSpinner size="sm" className="mt-4" />
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        {phase !== "ending" && phase !== "done" && (
          <div className="glass rounded-xl p-4 mt-2 flex-shrink-0">
            <textarea
              ref={textRef}
              className="w-full bg-muted rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
              placeholder={
                recording
                  ? "Recording in progress… click Stop to submit voice answer"
                  : "Type your answer here… (Ctrl+Enter to submit)"
              }
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === "Enter") handleTextSubmit();
              }}
              disabled={isSubmitting || recording}
            />
            <div className="flex items-center gap-2 mt-3 flex-wrap">

              {/* Voice toggle */}
              <button
                onClick={recording ? stopAndSubmitVoice : startRecording}
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 ${
                  recording
                    ? "bg-red-400/20 text-red-400 border border-red-400/40 hover:bg-red-400/30"
                    : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                }`}
                title={recording ? "Stop recording and submit" : "Start voice recording"}
              >
                {recording ? (
                  <><RecordingWave /> Stop & Submit</>
                ) : (
                  <><Mic className="w-4 h-4" /> Record</>
                )}
              </button>

              <div className="flex-1" />

              <span className="text-xs text-muted-foreground hidden sm:block">
                Ctrl+Enter to submit text
              </span>

              {/* Submit text */}
              <button
                onClick={handleTextSubmit}
                disabled={!inputText.trim() || isSubmitting || recording}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Submitting…" : "Submit"}
              </button>

              {/* End interview */}
              <button
                onClick={handleFinish}
                disabled={phase === "ending"}
                className="flex items-center gap-2 px-4 py-2 text-red-400 border border-red-400/30 bg-red-400/10 rounded-lg text-sm font-semibold hover:bg-red-400/20 transition disabled:opacity-40"
                title="End interview and get report"
              >
                <Square className="w-4 h-4" />
                End
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right sidebar ─────────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

        {/* Webcam + proctoring */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay muted playsInline
              className="w-full aspect-video object-cover bg-muted"
            />
            {recording && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/80 rounded-full px-1.5 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[9px] text-white font-bold">REC</span>
              </div>
            )}
          </div>
          <div className="p-3">
            <ProctoringMonitor
              interviewId={interviewId}
              videoRef={videoRef}
              onViolation={onViolation}
            />
          </div>
        </div>

        {/* Session stats */}
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Session Stats
          </p>
          {[
            ["Questions",  `${qIndex}/${total}`],
            ["Time Left",  formatDuration(timer)],
            ["Violations", violations.length || "None"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center mb-2 text-xs">
              <span className="text-muted-foreground">{k}</span>
              <span className={`font-bold font-mono ${k === "Violations" && violations.length > 0 ? "text-orange-400" : ""}`}>
                {v}
              </span>
            </div>
          ))}
        </div>

        {/* Violations log */}
        {violations.length > 0 && (
          <div className="glass rounded-xl p-3 border-orange-400/20">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Alerts
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {violations.slice(-5).map((v, i) => (
                <div key={i} className="text-[10px] text-muted-foreground">
                  <span className="text-orange-400 font-semibold">{v.type.replace("_", " ")}</span>
                  {" · "}
                  <span className="font-mono">{v.ts}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <BarChart2 className="w-3 h-3" /> Progress
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (qIndex / total) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            {Math.round(Math.min(100, (qIndex / total) * 100))}%
          </p>
        </div>

        {/* Tips */}
        <div className="glass rounded-xl p-3 border-accent/20 bg-accent/5">
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">💡 Tip</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {[
              "Use STAR: Situation, Task, Action, Result.",
              "Speak at 120–150 wpm for best clarity.",
              "Cite specific numbers and metrics.",
              "Pause briefly before complex answers.",
              "Maintain eye contact with the camera.",
            ][qIndex % 5]}
          </p>
        </div>
      </div>
    </div>
  );
}
