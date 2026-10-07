// src/pages/Interviews.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { History, ExternalLink, Plus } from "lucide-react";
import { getInterviews, getInterviewReport } from "@/lib/api";
import { scoreColor, scoreGrade, formatDate } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import LoadingSpinner from "@/components/common/LoadingSpinner";

export default function Interviews() {
  const navigate = useNavigate();
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const interviews = await getInterviews();
        // Enrich ended interviews with report scores
        const enriched = await Promise.all(
          interviews.map(async (h) => {
            if (h.status === "ended") {
              try {
                const report = await getInterviewReport(h._id);
                return { ...h, overall_score: report.overall_score, grade: report.grade, verdict: report.verdict };
              } catch {
                return h;
              }
            }
            return h;
          })
        );
        setList(enriched);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner fullScreen message="Loading history…" />;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Interview History</h1>
            <p className="text-muted-foreground text-sm">
              {list.length} session{list.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(ROUTES.SETUP)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> New Interview
        </button>
      </div>

      {!list.length ? (
        <div className="glass rounded-2xl p-16 text-center">
          <div className="text-5xl mb-4">📂</div>
          <h2 className="font-bold text-lg mb-2">No interviews yet</h2>
          <p className="text-muted-foreground text-sm mb-5">
            Complete your first interview to see results here
          </p>
          <button
            onClick={() => navigate(ROUTES.SETUP)}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm"
          >
            Start an Interview
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((h) => {
            const overall = h.overall_score || 0;
            const status  = h.status || "active";
            return (
              <div
                key={h._id}
                onClick={() => status === "ended" ? navigate(`/interviews/${h._id}`) : null}
                className={`glass rounded-2xl p-5 flex items-center justify-between transition-all group ${
                  status === "ended"
                    ? "cursor-pointer hover:border-primary/30"
                    : "opacity-70 cursor-default"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                      overall >= 75
                        ? "bg-emerald-400/10"
                        : overall >= 55
                        ? "bg-yellow-400/10"
                        : "bg-red-400/10"
                    }`}
                  >
                    {status !== "ended" ? "⏳" : overall >= 75 ? "🏆" : overall >= 55 ? "📈" : "📊"}
                  </div>
                  <div>
                    <p className="font-bold">{h.role || "Interview"}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.interviewType || h.mode || "interview"} ·{" "}
                      {formatDate(h.startedAt || h.date || "")}
                    </p>
                    {status !== "ended" && (
                      <span className="text-[10px] text-yellow-400 font-semibold">In Progress</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {status === "ended" && (
                    <div className="text-right">
                      <div
                        className="text-2xl font-extrabold"
                        style={{ color: overall ? scoreColor(overall) : "hsl(var(--muted-foreground))" }}
                      >
                        {overall ? Math.round(overall) : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {h.grade ? `Grade ${h.grade}` : "No report"}
                      </div>
                    </div>
                  )}
                  {status === "ended" && (
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
