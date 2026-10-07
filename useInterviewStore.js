// frontend/src/store/useInterviewStore.js
import { create } from "zustand";

const useInterviewStore = create((set) => ({
  // ── Session config (set during /setup) ────────────────────────────────────
  sessionConfig:    null,
  setSessionConfig: (config) => set({ sessionConfig: config }),

  // ── Active interview ID (returned by /api/interview/setup) ────────────────
  interviewId:      null,
  setInterviewId:   (id) => set({ interviewId: id }),

  // ── First question from setup ──────────────────────────────────────────────
  firstQuestion:    null,
  setFirstQuestion: (q) => set({ firstQuestion: q }),

  // ── Total questions for this session ──────────────────────────────────────
  totalQuestions:   0,
  setTotalQuestions:(n) => set({ totalQuestions: n }),

  // ── Final report data (after endInterview) ────────────────────────────────
  reportData:       null,
  setReportData:    (data) => set({ reportData: data }),

  // ── Legacy alias ──────────────────────────────────────────────────────────
  feedbackData:     null,
  setFeedbackData:  (data) => set({ feedbackData: data, reportData: data }),

  // ── Clear all session state ────────────────────────────────────────────────
  clearSession: () => set({
    sessionConfig:  null,
    interviewId:    null,
    firstQuestion:  null,
    totalQuestions: 0,
    reportData:     null,
    feedbackData:   null,
  }),
}));

export default useInterviewStore;
