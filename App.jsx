// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "./context/ThemeContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { Navbar } from "./components/layout/Navbar";
import { ROUTES } from "./lib/constants";
import { checkProfileCompletion, setClerkHeaders } from "./lib/api";
import LoadingSpinner from "./components/common/LoadingSpinner";

// Pages
import Home              from "./pages/Home";
import Dashboard         from "./pages/Dashboard";
import CompleteProfile   from "./pages/CompleteProfile";
import MyProfile         from "./pages/MyProfile";
import InterviewSetup    from "./pages/InterviewSetup";
import InterviewSession  from "./pages/InterviewSession";
import FeedbackPage      from "./pages/FeedbackPage";
import Interviews        from "./pages/Interviews";
import Settings          from "./pages/Settings";
import NotFound          from "./pages/NotFound";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in frontend/.env");

// ── Profile completion guard ──────────────────────────────────────────────────
function ProfileGuard({ children }) {
  const { isSignedIn, user } = useUser();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const skip = [ROUTES.PROFILE, "/"].includes(location.pathname);
      if (isSignedIn && user && !skip) {
        try {
          const res = await checkProfileCompletion(user);
          if (!res.profileCompleted) navigate(ROUTES.PROFILE, { replace: true });
        } catch { /* allow through on API error */ }
      }
      setChecking(false);
    };
    if (isSignedIn) check(); else setChecking(false);
  }, [isSignedIn, user, location.pathname, navigate]);

  if (checking && isSignedIn) return <LoadingSpinner fullScreen message="Checking profile…" />;
  return children;
}

// ── Main content ──────────────────────────────────────────────────────────────
function AppContent() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (isSignedIn && user) setClerkHeaders(user);
    else setClerkHeaders(null);
  }, [isSignedIn, user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <ProfileGuard>
          <Routes>
            <Route path={ROUTES.HOME} element={<Home />} />

            <Route path={ROUTES.PROFILE} element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
            <Route path={ROUTES.MYPROFILE} element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />

            <Route path={ROUTES.DASHBOARD}  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path={ROUTES.SETUP}      element={<ProtectedRoute><InterviewSetup /></ProtectedRoute>} />
            <Route path={ROUTES.INTERVIEW}  element={<ProtectedRoute><InterviewSession /></ProtectedRoute>} />
            <Route path={ROUTES.FEEDBACK}   element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
            <Route path="/interviews/:id"   element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
            <Route path={ROUTES.INTERVIEWS} element={<ProtectedRoute><Interviews /></ProtectedRoute>} />
            <Route path={ROUTES.SETTINGS}   element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ProfileGuard>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: "hsl(222 47% 7%)", color: "hsl(210 40% 92%)", border: "1px solid hsl(217 33% 14%)", fontSize: "13px" },
          success: { iconTheme: { primary: "#48bb78", secondary: "#080c14" } },
          error:   { iconTheme: { primary: "#fc8181", secondary: "#080c14" } },
        }}
      />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={clerkPubKey}>
        <ThemeProvider>
          <Router>
            <AppContent />
          </Router>
        </ThemeProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
