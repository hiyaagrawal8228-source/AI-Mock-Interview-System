// frontend/src/components/resume/ResumeManager.jsx
/**
 * ResumeManager
 * - Shows all uploaded resume versions
 * - Allows uploading a new resume (replaces active)
 * - Allows activating a previous version
 * - Allows deleting a version
 */
import { useState, useEffect, useRef } from "react";
import { Upload, CheckCircle, Trash2, Clock, FileText, Plus, Star } from "lucide-react";
import toast from "react-hot-toast";
import {
  uploadResume,
  listResumes,
  activateResume,
  deleteResume,
} from "@/lib/api";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

function ResumeCard({ resume, onActivate, onDelete, activating, deleting }) {
  const isActive = resume.isActive;
  return (
    <div
      className={`relative rounded-2xl p-4 border transition-all ${
        isActive
          ? "border-primary/60 bg-primary/5 shadow-md"
          : "border-border bg-card/50 hover:border-border/80"
      }`}
    >
      {isActive && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          <Star className="w-3 h-3" /> Active
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {resume.fileName || `Resume v${resume.version}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            v{resume.version} · {resume.fileSizeMB?.toFixed(1)} MB ·{" "}
            {new Date(resume.uploadedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          {resume.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {resume.skills.slice(0, 5).map((s) => (
                <span
                  key={s}
                  className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                >
                  {s}
                </span>
              ))}
              {resume.skills.length > 5 && (
                <span className="text-xs text-muted-foreground">
                  +{resume.skills.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        {!isActive && (
          <button
            onClick={() => onActivate(resume._id)}
            disabled={activating === resume._id}
            className="flex-1 text-xs py-1.5 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition disabled:opacity-50"
          >
            {activating === resume._id ? "Activating…" : "Set as Active"}
          </button>
        )}
        <button
          onClick={() => onDelete(resume._id)}
          disabled={deleting === resume._id}
          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
          title="Delete this version"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ResumeManager({ onResumeUploaded }) {
  const [resumes, setResumes]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef(null);

  const fetchResumes = async () => {
    try {
      const data = await listResumes();
      setResumes(data);
    } catch {
      setResumes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResumes(); }, []);

  const handleFile = async (file) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|docx?|txt)$/i)) {
      toast.error("Only PDF, DOCX, DOC, or TXT files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum 10 MB allowed");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Uploading and parsing resume…");
    try {
      const result = await uploadResume(file);
      toast.success(`Resume v${result.version} uploaded successfully!`, { id: toastId });
      await fetchResumes();
      onResumeUploaded?.(result.parsed_data);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Upload failed. Please try again.";
      toast.error(msg, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id) => {
    setActivating(id);
    try {
      await activateResume(id);
      toast.success("Resume version activated");
      await fetchResumes();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to activate");
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteResume(id);
      toast.success("Resume deleted");
      await fetchResumes();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Cannot delete");
    } finally {
      setDeleting(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-border/60 bg-card/30 hover:border-primary/50 hover:bg-primary/5"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          {uploading ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-primary" />
          )}
        </div>
        <p className="font-semibold text-sm mb-1">
          {uploading ? "Uploading…" : "Upload New Resume"}
        </p>
        <p className="text-xs text-muted-foreground">
          Drag & drop or click · PDF, DOCX, DOC, TXT · Max 10 MB
        </p>
        {resumes.length > 0 && (
          <p className="text-xs text-primary mt-2 font-medium">
            <Plus className="w-3 h-3 inline mr-1" />
            Add a new version — your previous resume is saved
          </p>
        )}
      </div>

      {/* Resume list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading resume history…
        </div>
      ) : resumes.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">
          No resumes uploaded yet. Upload one to get started.
        </p>
      ) : (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Resume History ({resumes.length} version{resumes.length !== 1 ? "s" : ""})
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {resumes.map((r) => (
              <ResumeCard
                key={r._id}
                resume={r}
                onActivate={handleActivate}
                onDelete={handleDelete}
                activating={activating}
                deleting={deleting}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
