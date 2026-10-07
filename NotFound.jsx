// src/pages/NotFound.jsx
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl mb-4">404</div>
      <h1 className="text-2xl font-extrabold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
      <button onClick={() => navigate("/")} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm">Go Home</button>
    </div>
  );
}
