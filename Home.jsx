// src/pages/Home.jsx
import { useNavigate } from "react-router-dom";
import { useUser, SignInButton } from "@clerk/clerk-react";
import { Brain, Mic, BarChart3, FileText, Zap, Shield, ArrowRight, CheckCircle } from "lucide-react";
import { ROUTES } from "@/lib/constants";

const features = [
  { icon: Brain,     color: "text-blue-400",   bg: "bg-blue-400/10",   title: "Adaptive Question Engine",  desc: "LLaMA 3.3 generates role-specific questions that adapt to your answers in real time." },
  { icon: Mic,       color: "text-purple-400",  bg: "bg-purple-400/10", title: "Speech Analysis",            desc: "Whisper STT + prosody analysis evaluates speaking rate, tone, fluency, and confidence." },
  { icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-400/10",title: "Multimodal Scoring",         desc: "Content 40% · Speech 30% · Behavior 20% · Grammar 10% — just like real interviews." },
  { icon: FileText,  color: "text-orange-400",  bg: "bg-orange-400/10", title: "Resume Intelligence",        desc: "Upload your PDF/DOCX resume. AI extracts skills, projects, and builds your personal question set." },
  { icon: Zap,       color: "text-yellow-400",  bg: "bg-yellow-400/10", title: "Real-Time Feedback",         desc: "Get actionable feedback with strengths, improvement areas, and a personal 90-day action plan." },
  { icon: Shield,    color: "text-red-400",      bg: "bg-red-400/10",    title: "Privacy First",              desc: "TLS + AES-256 encryption, 90-day retention policy, zero data sharing with third parties." },
];

const stats = [
  { number: "91.8%", label: "Overall Accuracy" },
  { number: "85%",   label: "Speech STT Rate" },
  { number: "78.5",  label: "SUS Usability Score" },
  { number: "200+",  label: "Sessions Tested" },
];

export default function Home() {
  const { isSignedIn } = useUser();
  const navigate = useNavigate();

  return (
    <div className="relative">
      <div className="grid-bg" />

      {/* Hero */}
      <section className="relative z-10 min-h-[calc(100vh-64px)] flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI-Powered · Multimodal Analysis · 91.8% Accuracy
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-none">
          Ace Every Interview<br />
          <span className="gradient-text">With AI Intelligence</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          Practice with an AI interviewer that evaluates your verbal content, speech patterns,
          facial cues, and grammar — just like a real technical interview panel.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          {isSignedIn ? (
            <button
              onClick={() => navigate(ROUTES.SETUP)}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:opacity-90 transition glow-blue"
            >
              Start Practicing <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:opacity-90 transition glow-blue">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </button>
            </SignInButton>
          )}
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="px-8 py-4 rounded-xl font-bold text-base border border-border bg-secondary text-foreground hover:border-primary/40 transition"
          >
            View Demo
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-12 mb-4">
          {stats.map(({ number, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-extrabold gradient-text">{number}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-extrabold mb-4">Everything You Need to Succeed</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Built on the same AI stack used in top tech interviews — LLaMA 3.3, Whisper, MediaPipe, BERT
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6 hover:border-primary/30 transition-all group">
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <h3 className="font-bold text-base mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-extrabold mb-4">How It Works</h2>
        </div>
        <div className="space-y-6">
          {[
            ["01", "Build Your Profile", "Upload your resume — AI parses it with NLP to extract skills, projects, and experience automatically."],
            ["02", "Configure the Session",  "Choose interview type (Technical, HR, Coding, or Full), difficulty level, and duration."],
            ["03", "Live AI Interview",      "Answer questions by voice or text. The AI adapts follow-up questions based on your responses."],
            ["04", "Get Deep Feedback",      "Receive a multimodal analysis report with scores, strengths, gaps, and a personalised action plan."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-5 p-6 glass rounded-2xl">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-extrabold text-sm">
                {num}
              </div>
              <div>
                <h3 className="font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="glass rounded-2xl p-12 glow-blue">
          <h2 className="text-3xl font-extrabold mb-4">Ready to Ace Your Next Interview?</h2>
          <p className="text-muted-foreground mb-8">Join hundreds of candidates who improved their interview performance with AI coaching.</p>
          {isSignedIn ? (
            <button onClick={() => navigate(ROUTES.SETUP)} className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition">
              Start a Mock Interview <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </button>
            </SignInButton>
          )}
        </div>
      </section>
    </div>
  );
}
