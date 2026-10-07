// frontend/src/pages/FeedbackPage.jsx
/**
 * FeedbackPage — Production rewrite
 *
 * ✅ Reads full report from store (set by endInterview) or loads via interview_id param
 * ✅ Per-question analysis cards with strength/improvement
 * ✅ Proctoring summary with violation breakdown
 * ✅ Final verdict: SELECTED / NEEDS_IMPROVEMENT / REJECTED
 * ✅ Communication + Technical + Confidence + Relevance breakdown
 * ✅ Print-ready layout
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import {
  RotateCcw, Download, CheckCircle, AlertCircle, TrendingUp,
  ShieldCheck, ShieldAlert, Award, ChevronDown, ChevronUp,
} from "lucide-react";
import toast            from "react-hot-toast";
import { getInterviewReport, endInterview } from "@/lib/api";
import { scoreColor, formatDate }           from "@/lib/utils";
import useInterviewStore                    from "@/store/useInterviewStore";
import LoadingSpinner                       from "@/components/common/LoadingSpinner";
import { ROUTES }                           from "@/lib/constants";

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 90, label }) {
  const r     = (size - 10) / 2;
  const circ  = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={5} fill="none" />
          <circle
            cx={size/2} cy={size/2} r={r}
            stroke={color} strokeWidth={5} fill="none"
            strokeDasharray={`${(score / 100) * circ} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1.2s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-extrabold text-base" style={{ color }}>{Math.round(score)}</span>
          <span className="text-[9px] text-muted-foreground">/100</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground text-center">{label}</span>}
    </div>
  );
}

// ── Verdict badge ─────────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
  SELECTED:         { label: "Selected",          color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", icon: "🎉" },
  NEEDS_IMPROVEMENT:{ label: "Needs Improvement", color: "text-yellow-400",  bg: "bg-yellow-400/10  border-yellow-400/30",  icon: "📈" },
  REJECTED:         { label: "Not Selected",      color: "text-red-400",     bg: "bg-red-400/10     border-red-400/30",     icon: "❌" },
  INCOMPLETE:       { label: "Incomplete",        color: "text-gray-400",    bg: "bg-gray-400/10    border-gray-400/30",    icon: "⚠️" },
};

function VerdictBadge({ verdict }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.INCOMPLETE;
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-bold ${cfg.bg} ${cfg.color}`}>
      <span className="text-lg">{cfg.icon}</span>
      {cfg.label}
    </div>
  );
}

// ── Per-question card ─────────────────────────────────────────────────────────
function QuestionCard({ item, index }) {
  const [open, setOpen] = useState(false);
  const color = scoreColor(item.score_out_of_10 * 10);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
      >
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
          {index + 1}
        </div>
        <p className="flex-1 text-sm font-medium text-muted-foreground truncate">
          {item.question}
        </p>
        <span className="font-extrabold text-sm flex-shrink-0" style={{ color }}>
          {item.score_out_of_10}/10
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3 animate-fade-in">
          {/* Answer */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Your Answer</p>
            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 rounded-lg p-3">
              {item.answer || "No answer provided"}
            </p>
          </div>

          {/* Scores mini-grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Technical",  item.technical_score],
              ["Confidence", item.confidence_score],
              ["Comms",      item.communication_score],
              ["Relevance",  item.relevance_score],
            ].map(([label, val]) => (
              <div key={label} className="text-center bg-muted/40 rounded-lg py-2">
                <div className="font-bold text-sm" style={{ color: scoreColor(val) }}>
                  {Math.round(val)}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Strength + Improvement */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-lg p-2.5">
              <p className="text-[9px] font-bold text-emerald-400 uppercase mb-1 flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" /> Strength
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.strength}</p>
            </div>
            <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-2.5">
              <p className="text-[9px] font-bold text-yellow-400 uppercase mb-1 flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5" /> Improve
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.improvement}</p>
            </div>
          </div>

          {/* Keywords */}
          {item.keywords_hit?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">Keywords hit:</span>
              {item.keywords_hit.map((k) => (
                <span key={k} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function FeedbackPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { reportData, interviewId, clearSession } = useInterviewStore();

  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("overview");

  useEffect(() => {
    const load = async () => {
      try {
        // 1. Try cached report from store
        if (reportData && !id) {
          setReport(reportData);
          return;
        }
        // 2. Load by URL param
        const targetId = id || interviewId;
        if (targetId) {
          const r = await getInterviewReport(targetId);
          setReport(r);
        } else {
          navigate(ROUTES.SETUP);
        }
      } catch (err) {
        toast.error(err?.message || "Could not load report");
        navigate(ROUTES.INTERVIEWS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, reportData]);

  if (loading) return <LoadingSpinner fullScreen message="Loading report…" />;
  if (!report) return null;

  const perQ          = report.per_question_analysis || [];
  const proctoring    = report.proctoring || {};
  const strengths     = report.strengths || [];
  const weaknesses    = report.weaknesses || [];
  const recs          = report.recommendations || [];

  // Radar data
  const radarData = [
    { subject: "Technical",      A: report.technical_score      || 0 },
    { subject: "Confidence",     A: report.confidence_score     || 0 },
    { subject: "Communication",  A: report.communication_score  || 0 },
    { subject: "Relevance",      A: report.relevance_score      || 0 },
    { subject: "Proctoring",     A: report.proctoring_score     || 0 },
  ];

  // Bar data for per-question scores
  const barData = perQ.map((q) => ({
    name:  `Q${q.question_number}`,
    score: Math.round(q.score_out_of_10 * 10),
  }));

  const TABS = [
    ["overview",   "📊 Overview"],
    ["questions",  "📝 Questions"],
    ["proctoring", "👁️ Proctoring"],
    ["action",     "🎯 Action Plan"],
  ];

  console.log("REPORT IN FEEDBACK:", report);
  return (
    <div className="max-w-5xl mx-auto py-10 px-4 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <VerdictBadge verdict={report.verdict} />
          {report.generatedAt && (
            <span className="text-xs text-muted-foreground">
              {formatDate(report.generatedAt)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-xs font-bold bg-muted px-3 py-1 rounded-full">
            <Award className="w-3.5 h-3.5 text-primary" />
            Grade {report.grade} · {report.skill_level}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold mb-1">Interview Report</h1>
        {report.role && (
          <p className="text-muted-foreground capitalize">{report.role} · {report.difficulty} · {report.interviewType}</p>
        )}
      </div>

      {/* ── Score cards ────────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-5 mb-5">
        <div className="flex flex-wrap justify-around gap-6">
          <div className="text-center">
            <ScoreRing score={report.overall_score || 0} size={100} />
            <p className="text-xs font-bold mt-1 text-primary">Overall</p>
          </div>
          <ScoreRing score={report.technical_score     || 0} size={70} label="Technical"     />
          <ScoreRing score={report.confidence_score    || 0} size={70} label="Confidence"    />
          <ScoreRing score={report.communication_score || 0} size={70} label="Communication" />
          <ScoreRing score={report.relevance_score     || 0} size={70} label="Relevance"     />
          <ScoreRing score={report.proctoring_score    || 0} size={70} label="Proctoring"    />
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold -mb-px transition ${
              tab === key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-5">

            {/* Radar */}
            <div className="glass rounded-2xl p-5">
              <p className="text-sm font-bold mb-4">Skill Radar</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Radar
                    name="Score" dataKey="A"
                    stroke="hsl(var(--primary))" fill="hsl(var(--primary))"
                    fillOpacity={0.18} strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Strengths / Weaknesses */}
            <div className="space-y-3">
              <div className="glass rounded-2xl p-4 border-emerald-400/20 bg-emerald-400/5 flex-1">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Strengths
                </p>
                {(strengths.length ? strengths : ["Keep up the good work!"]).map((s, i) => (
                  <div key={i} className="flex gap-2 mb-2 text-xs">
                    <span className="text-emerald-400 flex-shrink-0 mt-0.5">◆</span>
                    <span className="text-muted-foreground leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
              <div className="glass rounded-2xl p-4 border-yellow-400/20 bg-yellow-400/5 flex-1">
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Areas to Improve
                </p>
                {(weaknesses.length ? weaknesses : ["Great job overall!"]).map((w, i) => (
                  <div key={i} className="flex gap-2 mb-2 text-xs">
                    <span className="text-yellow-400 flex-shrink-0 mt-0.5">◆</span>
                    <span className="text-muted-foreground leading-relaxed">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Score bar chart */}
          {barData.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <p className="text-sm font-bold mb-4">Score per Question</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} barCategoryGap="25%">
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={scoreColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: QUESTIONS */}
      {tab === "questions" && (
        <div className="space-y-3 animate-fade-in">
          {perQ.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No per-question analysis available.
            </p>
          ) : (
            perQ.map((item, i) => <QuestionCard key={i} item={item} index={i} />)
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: PROCTORING */}
      {tab === "proctoring" && (
        <div className="space-y-5 animate-fade-in">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-5">
              {(proctoring.score ?? 100) >= 90 ? (
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-8 h-8 text-orange-400" />
              )}
              <div>
                <p className="font-bold">Proctoring Score: {proctoring.score ?? 100}%</p>
                <p className={`text-sm font-semibold ${
                  proctoring.verdict === "CLEAN" ? "text-emerald-400" :
                  proctoring.verdict === "MINOR_VIOLATIONS" ? "text-yellow-400" : "text-red-400"
                }`}>
                  {proctoring.verdict || "CLEAN"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="text-center bg-muted/40 rounded-xl p-3">
                <div className="text-2xl font-extrabold">{proctoring.total_frames || 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Frames Analysed</div>
              </div>
              <div className="text-center bg-muted/40 rounded-xl p-3">
                <div className="text-2xl font-extrabold text-orange-400">
                  {Object.values(proctoring.violations || {}).reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Total Violations</div>
              </div>
              <div className="text-center bg-muted/40 rounded-xl p-3">
                <div className="text-2xl font-extrabold text-primary">{proctoring.score ?? 100}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">Clean Frames</div>
              </div>
            </div>

            {Object.keys(proctoring.violations || {}).length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Violation Breakdown</p>
                {Object.entries(proctoring.violations).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="w-36 text-xs text-muted-foreground">{type.replace("_", " ")}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full"
                        style={{ width: `${(count / (proctoring.total_frames || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-400 text-center py-2">✅ No violations detected</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: ACTION PLAN */}
      {tab === "action" && (
        <div className="space-y-5 animate-fade-in">
          <div className="glass rounded-2xl p-6">
            <p className="text-sm font-bold flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" /> Your Personalised Action Plan
            </p>
            {(recs.length ? recs : ["Keep practising with mock interviews"]).map((item, i) => (
              <div key={i} className="flex gap-4 mb-4 last:mb-0">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-extrabold flex-shrink-0">
                  {i + 1}
                </div>
                <p className="pt-0.5 text-sm text-muted-foreground leading-relaxed">{item}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border-accent/20 bg-accent/5">
            <p className="text-xs font-bold text-accent uppercase tracking-wider mb-3">📚 Resources</p>
            {[
              "NeetCode.io — Structured DSA roadmap with video explanations",
              "System Design Primer (GitHub) — Scalability & architecture patterns",
              "Pramp.com — Free peer mock interviews",
              "Grammarly / Hemingway App — Improve communication precision",
              "STAR Method Guide — Behavioural question framework",
            ].map((r, i) => (
              <div key={i} className="flex gap-2 text-xs mb-2 last:mb-0">
                <span className="text-accent flex-shrink-0 mt-0.5">→</span>
                <span className="text-muted-foreground">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mt-8">
        <button
          onClick={() => { clearSession(); navigate(ROUTES.SETUP); }}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition"
        >
          <RotateCcw className="w-4 h-4" /> New Interview
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-3 border border-border bg-secondary rounded-xl font-bold text-sm hover:border-primary/40 transition"
        >
          <Download className="w-4 h-4" /> Print Report
        </button>
        <button
          onClick={() => navigate(ROUTES.INTERVIEWS)}
          className="flex items-center gap-2 px-5 py-3 border border-border bg-secondary rounded-xl font-bold text-sm hover:border-primary/40 transition"
        >
          View History
        </button>
      </div>
    </div>
  );
}
