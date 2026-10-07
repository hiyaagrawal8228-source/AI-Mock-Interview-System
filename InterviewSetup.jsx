// frontend/src/pages/InterviewSetup.jsx
/**
 * InterviewSetup — fixed to:
 *  ✅ Call /api/interview/setup (new endpoint)
 *  ✅ Store interview_id + firstQuestion in store
 *  ✅ Show resume manager with multi-version support
 *  ✅ Validate that user has an active resume before starting
 */

import { useState, useEffect } from "react";
import { useNavigate }    from "react-router-dom";
import { Briefcase, Clock, Zap, ChevronRight, FileText } from "lucide-react";
import toast              from "react-hot-toast";
import { setupInterview, getActiveResume } from "@/lib/api";
import useInterviewStore  from "@/store/useInterviewStore";
import { ROUTES }         from "@/lib/constants";
import ResumeManager      from "@/components/resume/ResumeManager";
import LoadingSpinner     from "@/components/common/LoadingSpinner";

const TYPES = [
  { value: "technical",  label: "Technical",  desc: "DSA, System Design, CS fundamentals" },
  { value: "behavioral", label: "Behavioral", desc: "HR/soft-skill competency questions"   },
  { value: "coding",     label: "Coding",     desc: "Live coding challenges"               },
  { value: "full",       label: "Full Round", desc: "Technical + HR + Coding"              },
];

const DURATIONS = [5, 10, 15, 20, 30, 45, 60];

const DIFFICULTIES = [
  { value: "easy",   label: "Easy",   color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  { value: "medium", label: "Medium", color: "text-yellow-400  border-yellow-400/30  bg-yellow-400/10"  },
  { value: "hard",   label: "Hard",   color: "text-red-400     border-red-400/30     bg-red-400/10"     },
];

export default function InterviewSetup() {
  const navigate = useNavigate();
  const { setSessionConfig, setInterviewId, setFirstQuestion, setTotalQuestions, clearSession } =
    useInterviewStore();

  const [step,       setStep]       = useState(0);  // 0=resume, 1=config
  const [resumeData, setResumeData] = useState(null);
  const [loadingResume, setLoadingResume] = useState(true);

  const [role,       setRole]       = useState("");
  const [type,       setType]       = useState("technical");
  const [duration,   setDuration]   = useState(15);
  const [difficulty, setDifficulty] = useState("medium");
  const [starting,   setStarting]   = useState(false);

  // Try to load existing active resume
  useEffect(() => {
    getActiveResume()
      .then((r) => { setResumeData(r); setStep(1); })
      .catch(() => {})
      .finally(() => setLoadingResume(false));
  }, []);

  const handleResumeUploaded = (parsed) => {
    setResumeData(parsed);
    // Auto-fill role from parsed resume
    if (parsed?.role && !role) setRole(parsed.role);
    setStep(1);
    toast.success("Resume ready! Configure your interview below.");
  };

  const handleStart = async () => {
    if (!role.trim()) {
      toast.error("Please enter a job role / position you're targeting.");
      return;
    }
    if (!resumeData) {
      toast.error("Please upload a resume before starting.");
      setStep(0);
      return;
    }

    setStarting(true);
    clearSession();

    try {
      const result = await setupInterview({
        role:           role.trim(),
        interview_type: type,
        duration,
        difficulty,
      });

      setSessionConfig({ role, type, duration, difficulty });
      setInterviewId(result.interview_id);
      setFirstQuestion(result.first_question);
      setTotalQuestions(result.total_questions);

      navigate(ROUTES.SESSION);
    } catch (err) {
      toast.error(err?.message || "Failed to start interview. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  if (loadingResume) return <LoadingSpinner fullScreen message="Loading profile…" />;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-1">Start Interview</h1>
        <p className="text-muted-foreground text-sm">
          {step === 0 ? "First, upload your resume" : "Configure your session"}
        </p>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 mb-6 border-b border-border pb-0">
        {[
          { i: 0, label: "📄 Resume" },
          { i: 1, label: "⚙️ Configure" },
        ].map(({ i, label }) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`px-4 py-2.5 text-sm font-semibold -mb-px transition ${
              step === i
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Step 0: Resume ──────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="animate-fade-in">
          <ResumeManager onResumeUploaded={handleResumeUploaded} />
          {resumeData && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition"
              >
                Continue to Configure <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Configure ───────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in">

          {/* Resume status chip */}
          {resumeData ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-3 py-2">
              <FileText className="w-3.5 h-3.5" />
              <span>
                Active resume: <strong>{resumeData.fileName || `v${resumeData.version}`}</strong>
              </span>
              <button
                onClick={() => setStep(0)}
                className="ml-auto text-primary underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-xl px-3 py-2">
              <FileText className="w-3.5 h-3.5" />
              <span>No resume uploaded yet.</span>
              <button onClick={() => setStep(0)} className="ml-auto text-primary underline">
                Upload
              </button>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              <Briefcase className="w-3.5 h-3.5 inline mr-1" /> Target Role / Position
            </label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Backend Engineer, Full Stack Developer, Data Scientist…"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
          </div>

          {/* Interview type */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Interview Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`rounded-xl p-3 text-left border transition ${
                    type === t.value
                      ? "border-primary/60 bg-primary/5 shadow-sm"
                      : "border-border bg-card/50 hover:border-border/80"
                  }`}
                >
                  <div className="font-semibold text-sm">{t.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5 inline mr-1" /> Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                    duration === d
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-card/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              ~{Math.max(2, Math.floor(duration / 2))} questions
            </p>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5 inline mr-1" /> Difficulty
            </label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                    difficulty === d.value ? d.color : "border-border bg-card/50 text-muted-foreground"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary + Start */}
          <div className="glass rounded-2xl p-5 border-primary/20 bg-primary/5">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Session Summary</p>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Role</span>
              <span className="font-semibold">{role || "—"}</span>
              <span className="text-muted-foreground">Type</span>
              <span className="font-semibold capitalize">{type}</span>
              <span className="text-muted-foreground">Duration</span>
              <span className="font-semibold">{duration} minutes</span>
              <span className="text-muted-foreground">Questions</span>
              <span className="font-semibold">~{Math.max(2, Math.floor(duration / 2))}</span>
              <span className="text-muted-foreground">Difficulty</span>
              <span className="font-semibold capitalize">{difficulty}</span>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={starting || !role.trim()}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-extrabold text-base hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {starting ? (
              <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Starting…</>
            ) : (
              <><Zap className="w-5 h-5" /> Start Interview</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
