// src/components/TranscriptView.jsx
import { MessageSquare } from "lucide-react";

function normalizeTranscriptString(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/\r/g, "")
    .replace(/===.*?===\n?/g, "")
    .replace(/Q\d+:/g, "Q:")
    .replace(/A\d+:/g, "A:");
}

function parseTranscriptString(raw) {
  if (!raw || typeof raw !== "string") return [];
  const cleaned = normalizeTranscriptString(raw);
  if (!cleaned.trim()) return [];
  const blocks = cleaned.trim().split(/(?=Q:\s*)/g).filter(Boolean);
  return blocks.map((block) => {
    const qMatch = block.match(/Q:\s*(.*?)(?=A:\s*)/s);
    const aMatch = block.match(/A:\s*(.*)/s);
    return {
      question: qMatch ? qMatch[1].trim().replace(/\s+/g, " ") : "",
      answer:   aMatch ? aMatch[1].trim().replace(/\s+/g, " ") : "",
    };
  }).filter((x) => x.question || x.answer);
}

export function TranscriptView({ transcript }) {
  const items = typeof transcript === "string"
    ? parseTranscriptString(transcript)
    : transcript || [];

  if (!items.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No transcript available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-xl border border-border overflow-hidden">
          <div className="bg-primary/5 border-b border-border px-4 py-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Question {idx + 1}
            </span>
            <p className="text-sm text-foreground mt-1 leading-relaxed">{item.question}</p>
          </div>
          <div className="px-4 py-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Your Answer
            </span>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
              {item.answer || "—"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

