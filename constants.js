// frontend/src/lib/constants.js

export const ROUTES = {
  HOME:       "/",
  DASHBOARD:  "/dashboard",
  PROFILE:    "/profile",
  MYPROFILE:  "/my-profile",
  SETUP:      "/setup",
  SESSION:    "/interview",   // ← was missing, caused navigate to crash
  INTERVIEW:  "/interview",
  FEEDBACK:   "/feedback",
  INTERVIEWS: "/interviews",
  SETTINGS:   "/settings",
};

export const INTERVIEW_TYPES = [
  { id: "technical",  label: "Technical",       icon: "💻", desc: "DSA, System Design, CS fundamentals" },
  { id: "behavioral", label: "Behavioral (HR)",  icon: "🤝", desc: "Soft skills & STAR scenarios" },
  { id: "coding",     label: "Coding Round",     icon: "⌨️", desc: "Live coding with real problems" },
  { id: "full",       label: "Full Interview",   icon: "🎯", desc: "Technical + Coding + HR combined" },
];

export const DIFFICULTY_LEVELS = [
  { id: "easy",   label: "Easy",   desc: "0–1 years experience" },
  { id: "medium", label: "Medium", desc: "2–4 years experience" },
  { id: "hard",   label: "Hard",   desc: "5+ years experience" },
];

export const DURATIONS = [
  { value: 5,  label: "5 min"  },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
];

// Backend API URL — set VITE_API_BASE_URL in .env, or defaults to empty (proxy via Vite)
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
