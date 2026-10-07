// src/components/common/ProtectedRoute.jsx
import { useUser } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner";

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser();
  const location = useLocation();

  if (!isLoaded) return <LoadingSpinner fullScreen />;
  if (!isSignedIn) return <Navigate to="/" state={{ from: location }} replace />;

  return children;
}
