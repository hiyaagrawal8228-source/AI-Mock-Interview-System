// src/components/layout/Navbar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser, UserButton, SignInButton } from "@clerk/clerk-react";
import { Brain, LayoutDashboard, History, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

const navLinks = [
  { to: ROUTES.DASHBOARD,  label: "Dashboard", icon: LayoutDashboard },
  { to: ROUTES.INTERVIEWS, label: "History",   icon: History },
  { to: ROUTES.SETTINGS,   label: "Settings",  icon: Settings },
];

export function Navbar() {
  const { isSignedIn } = useUser();
  const location = useLocation();
  const navigate  = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 glass border-b border-border">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to={ROUTES.HOME} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Interview<span className="text-primary">AI</span>
          </span>
        </Link>

        {/* Nav links */}
        {isSignedIn && (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  location.pathname === to
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <button
                onClick={() => navigate(ROUTES.SETUP)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" />
                New Interview
              </button>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition">
                Sign In
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
