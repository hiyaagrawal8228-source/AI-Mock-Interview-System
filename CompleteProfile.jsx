// src/pages/CompleteProfile.jsx
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Upload, Plus, X, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { updateUserProfile, parseResume } from "@/lib/api";
import { ROUTES } from "@/lib/constants";

export default function CompleteProfile() {
  const { user } = useUser();
  const navigate  = useNavigate();
  const fileRef   = useRef(null);

  const [form, setForm] = useState({
    name: user?.fullName || "",
    role: "", college: "", degree: "", graduationYear: "",
    skills: [], skillInput: "",
    targetCompanies: [], companyInput: "",
  });
  const [parsing,  setParsing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [parseMsg, setParseMsg] = useState("");

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setParseMsg("Parsing resume with AI...");
    try {
      const data = await parseResume(file);
      setForm((p) => ({
        ...p,
        name:    data.name    || p.name,
        role:    data.role    || p.role,
        skills:  [...new Set([...p.skills, ...(data.skills || [])])],
        college: (data.education?.[0]) || p.college,
      }));
      setParseMsg("✓ Resume parsed successfully!");
    } catch {
      setParseMsg("⚠ Could not parse resume. Fill in manually.");
    }
    setParsing(false);
  };

  const addSkill = () => {
    const s = form.skillInput.trim();
    if (s && !form.skills.includes(s)) update("skills", [...form.skills, s]);
    update("skillInput", "");
  };

  const addCompany = () => {
    const c = form.companyInput.trim();
    if (c && !form.targetCompanies.includes(c)) update("targetCompanies", [...form.targetCompanies, c]);
    update("companyInput", "");
  };

  const save = async () => {
    if (!form.name || !form.role || !form.college || !form.degree) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({
        name: form.name, role: form.role,
        college: form.college, degree: form.degree,
        graduationYear: form.graduationYear,
        skills: form.skills, targetCompanies: form.targetCompanies,
      });
      toast.success("Profile saved!");
      navigate(ROUTES.DASHBOARD);
    } catch {
      toast.error("Failed to save profile. Try again.");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 animate-fade-in">
      <div className="mb-8">
        <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-3">
          PROFILE SETUP
        </div>
        <h1 className="text-3xl font-extrabold mb-2">Complete Your Profile</h1>
        <p className="text-muted-foreground">Upload your resume or fill in manually to get personalised interview questions</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-5">
          {/* Resume upload */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">📄 Resume Upload</span>
              {parseMsg && <span className="text-xs text-emerald-400">{parseMsg}</span>}
            </div>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">{parseMsg}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-semibold mb-1">Drop your resume here</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT · Auto-parsed with AI</p>
                </>
              )}
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => handleFile(e.target.files[0])} />
            </div>
          </div>

          {/* Basic Info */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-sm">👤 Basic Information</h3>
            {[
              ["Full Name",         "name",           "e.g. Ayaan Khan"],
              ["Target Role",       "role",           "e.g. Software Engineer"],
              ["College / University", "college",     "e.g. VIT University"],
              ["Degree",            "degree",         "e.g. B.Tech Computer Science"],
              ["Graduation Year",   "graduationYear", "e.g. 2025"],
            ].map(([label, key, placeholder]) => (
              <div key={key}>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  {label} {["name","role","college","degree"].includes(key) && <span className="text-red-400">*</span>}
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-5">
          {/* Skills */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">🛠️ Technical Skills</h3>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                placeholder="Add skill (Enter)"
                value={form.skillInput}
                onChange={(e) => update("skillInput", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
              />
              <button onClick={addSkill} className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-primary hover:bg-primary/20 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                  {s}
                  <button onClick={() => update("skills", form.skills.filter((x) => x !== s))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {!form.skills.length && <span className="text-xs text-muted-foreground">No skills added yet</span>}
            </div>
          </div>

          {/* Target companies */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">🏢 Target Companies</h3>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                placeholder="e.g. Google, Amazon"
                value={form.companyInput}
                onChange={(e) => update("companyInput", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCompany()}
              />
              <button onClick={addCompany} className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-primary hover:bg-primary/20 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.targetCompanies.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-400/10 border border-purple-400/20 text-purple-400 text-xs font-semibold">
                  {c}
                  <button onClick={() => update("targetCompanies", form.targetCompanies.filter((x) => x !== c))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            onClick={save} disabled={saving}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Profile & Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
