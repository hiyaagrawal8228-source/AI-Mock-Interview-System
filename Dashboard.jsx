// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Plus, TrendingUp, Target, Calendar, Award } from "lucide-react";
import { getDashboardStats, getPerformanceTrend, getInterviews } from "@/lib/api";
import { scoreColor, formatDate } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import LoadingSpinner from "@/components/common/LoadingSpinner";

export default function Dashboard() {
  const { user }  = useUser();
  const navigate  = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [trend,   setTrend]   = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getPerformanceTrend(), getInterviews()])
      .then(([s, t, h]) => {
        setStats(s);
        setTrend(t);
        setHistory(h.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullScreen message="Loading dashboard…" />;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">
            Welcome back,{" "}
            <span className="gradient-text">{user?.firstName || "there"}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Here's your interview performance summary
          </p>
        </div>
        <button
          onClick={() => navigate(ROUTES.SETUP)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> New Interview
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        {[
          {
            icon: Target,
            label: "Total Sessions",
            value: stats?.totalInterviews ?? 0,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
          },
          {
            icon: TrendingUp,
            label: "Avg Score",
            value: stats?.averageScore ? `${stats.averageScore}%` : "—",
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
          },
          {
            icon: Calendar,
            label: "This Week",
            value: stats?.thisWeek ?? 0,
            color: "text-purple-400",
            bg: "bg-purple-400/10",
          },
          {
            icon: Award,
            label: "Completed",
            value: stats?.completedCount ?? 0,
            color: "text-yellow-400",
            bg: "bg-yellow-400/10",
          },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-extrabold">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts + history */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Performance trend */}
        <div className="glass rounded-2xl p-5">
          <p className="font-bold text-sm mb-4">Performance Trend</p>
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => v?.slice(5, 10) || ""}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Overall Score"
                />
                <Line
                  type="monotone"
                  dataKey="technical"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={false}
                  name="Technical"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">📈</div>
                <p className="text-xs text-muted-foreground">
                  Complete more interviews to see your trend
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recent interviews */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm">Recent Interviews</p>
            <button
              onClick={() => navigate(ROUTES.INTERVIEWS)}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          {history.length ? (
            <div className="space-y-3">
              {history.map((h) => (
                <div
                  key={h._id}
                  onClick={() => h.status === "ended" && navigate(`/interviews/${h._id}`)}
                  className={`flex items-center justify-between p-3 rounded-xl bg-muted/50 transition ${
                    h.status === "ended" ? "hover:bg-muted cursor-pointer" : "opacity-60"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm">{h.role || "Interview"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(h.startedAt || h.date || "")}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      h.status === "ended"
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-yellow-400/10 text-yellow-400"
                    }`}
                  >
                    {h.status === "ended" ? "Completed" : "In Progress"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <p className="text-xs text-muted-foreground">No interviews yet</p>
                <button
                  onClick={() => navigate(ROUTES.SETUP)}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  Start your first interview →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent report summary */}
      {stats?.recentInterview && (
        <div className="glass rounded-2xl p-5 mt-5 border-primary/20 bg-primary/5">
          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
            🎯 Latest Interview
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{stats.recentInterview.role}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(stats.recentInterview.date)}
              </p>
            </div>
            <div className="text-right">
              <div
                className="text-3xl font-extrabold"
                style={{ color: scoreColor(stats.recentInterview.score || 0) }}
              >
                {stats.recentInterview.score || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Grade {stats.recentInterview.grade || "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
