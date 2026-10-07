// frontend/src/lib/api.js
import axios from "axios";
import { API_BASE } from "./constants";

// ── Axios instance ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE,
  timeout: 90000, // 90s for audio transcription
});

// ── Response interceptor — surface backend error messages ─────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err?.response?.data?.detail;
    if (detail && typeof detail === "string") {
      err.message = detail;
    }
    return Promise.reject(err);
  }
);

// ── Attach Clerk user headers ──────────────────────────────────────────────────
export function setClerkHeaders(user) {
  if (user) {
    api.defaults.headers.common["X-User-Id"]    = user.id;
    api.defaults.headers.common["X-User-Email"] = user.primaryEmailAddress?.emailAddress || "";
  } else {
    delete api.defaults.headers.common["X-User-Id"];
    delete api.defaults.headers.common["X-User-Email"];
  }
}

// ═══════════════════════════════════════════════════════════
// USER / PROFILE
// ═══════════════════════════════════════════════════════════

export const checkProfileCompletion = async (user) => {
  setClerkHeaders(user);
  const { data } = await api.get("/api/user/check-profile");
  return data;
};

export const getUserProfile = async () => {
  const { data } = await api.get("/api/user/profile");
  return data;
};

export const updateUserProfile = async (profileData) => {
  const { data } = await api.put("/api/user/profile", profileData);
  return data;
};

// ═══════════════════════════════════════════════════════════
// RESUME  (versioned)
// ═══════════════════════════════════════════════════════════

/**
 * Upload a new resume version.
 * @param {File} file
 * @returns {{ version, resume_id, parsed_data, message }}
 */
export const uploadResume = async (file) => {
  const form = new FormData();
  form.append("resume", file);
  const { data } = await api.post("/api/resume/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

/** List all resume versions for the user (newest first). */
export const listResumes = async () => {
  const { data } = await api.get("/api/resume/list");
  return data;
};

/** Get the active (latest) resume. */
export const getActiveResume = async () => {
  const { data } = await api.get("/api/resume/active");
  return data;
};

/** Activate a specific resume version by ID. */
export const activateResume = async (resumeId) => {
  const { data } = await api.put(`/api/resume/${resumeId}/activate`);
  return data;
};

/** Delete a resume version. */
export const deleteResume = async (resumeId) => {
  const { data } = await api.delete(`/api/resume/${resumeId}`);
  return data;
};

// ═══════════════════════════════════════════════════════════
// INTERVIEW SESSION
// ═══════════════════════════════════════════════════════════

/**
 * Create a new interview session.
 * @returns {{ interview_id, first_question, total_questions, difficulty, skills }}
 */
export const setupInterview = async ({ role, interview_type, duration, difficulty = "easy" }) => {
  const { data } = await api.post("/api/interview/setup", {
    role, interview_type, duration, difficulty,
  });
  return data;
};

/**
 * Submit a text answer.
 * @returns {{ status: "continue"|"complete", next_question?, evaluation }}
 */
export const submitTextAnswer = async ({ interview_id, answer_text, focus_score = 1.0 }) => {
  if (!answer_text?.trim()) {
    throw new Error("Answer cannot be empty. Please type your response.");
  }
  const { data } = await api.post("/api/interview/answer/text", {
    interview_id,
    answer_text: answer_text.trim(),
    focus_score,
  });
  return data;
};

/**
 * Submit a voice answer (audio blob).
 * @param {Blob}   audioBlob
 * @param {string} interview_id
 * @param {number} focus_score   0.0–1.0
 * @returns {{ status, transcription, next_question?, evaluation }}
 */
export const submitVoiceAnswer = async (audioBlob, interview_id, focus_score = 1.0) => {
  const form = new FormData();
  form.append("audio",        audioBlob, "answer.webm");
  form.append("interview_id", interview_id);
  form.append("focus_score",  focus_score.toString());
  const { data } = await api.post("/api/interview/answer/voice", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,  // STT can take time
  });
  return data;
};

/**
 * End the interview and generate the full report.
 * @returns Full report object
 */
export const endInterview = async (interview_id) => {
  const { data } = await api.post(`/api/interview/${interview_id}/end`);
  return data;
};

/** Get generated report for an interview. */
export const getInterviewReport = async (interview_id) => {
  const { data } = await api.get(`/api/interview/${interview_id}/report`);
  return data;
};

/** Get all interviews for user. */
export const getInterviews = async () => {
  const { data } = await api.get("/api/interview/history");
  return data;
};

/** Get single interview details. */
export const getInterview = async (id) => {
  const { data } = await api.get(`/api/interview/${id}`);
  return data;
};

// ═══════════════════════════════════════════════════════════
// PROCTORING
// ═══════════════════════════════════════════════════════════

/**
 * Send a base64 webcam frame for face analysis.
 * @param {{ interview_id: string, frame_b64: string, timestamp?: string }}
 * @returns {{ face_count, confidence, violation, violation_detail, timestamp }}
 */
export const analyzeFrame = async ({ interview_id, frame_b64, timestamp }) => {
  const { data } = await api.post("/api/proctor/frame", {
    interview_id,
    frame_b64,
    timestamp: timestamp || new Date().toISOString(),
  });
  return data;
};

/** Get proctoring summary for an interview. */
export const getProctoringsummary = async (interview_id) => {
  const { data } = await api.get(`/api/proctor/${interview_id}/summary`);
  return data;
};

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

export const getDashboardStats = async () => {
  const { data } = await api.get("/api/dashboard/stats");
  return data;
};

export const getPerformanceTrend = async () => {
  const { data } = await api.get("/api/dashboard/performance-trend");
  return data;
};

// ── Legacy compat shims (used by old code) ─────────────────────────────────────
/** @deprecated Use setupInterview() */
export const setupSession = async (role, interviewType, duration) =>
  setupInterview({ role, interview_type: interviewType, duration });

/** @deprecated Use submitTextAnswer() or submitVoiceAnswer() */
export const sendAudio = async (audioBlob, focusScore = 1.0, text) => {
  console.warn("sendAudio() is deprecated. Use submitTextAnswer() or submitVoiceAnswer().");
  if (text) {
    return submitTextAnswer({ interview_id: "legacy", answer_text: text, focus_score: focusScore });
  }
  return submitVoiceAnswer(audioBlob, "legacy", focusScore);
};

/** @deprecated Use getInterviewReport(id) after endInterview(id) */
export const getFeedback = async () => {
  console.warn("getFeedback() is deprecated. Use endInterview(id) then getInterviewReport(id).");
  const interviews = await getInterviews();
  if (interviews.length === 0) throw new Error("No interviews found");
  const latest = interviews[0];
  return endInterview(latest._id);
};

/** @deprecated Use uploadResume() */
export const parseResume = async (file) => uploadResume(file);

export default api;
