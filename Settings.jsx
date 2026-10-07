// src/pages/Settings.jsx
import { useUser } from "@clerk/clerk-react";

export default function Settings() {
  const { user } = useUser();
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
      <h1 className="text-3xl font-extrabold mb-6">Settings</h1>
      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</label>
          <p className="mt-1 text-sm">{user?.fullName || "—"}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</label>
          <p className="mt-1 text-sm">{user?.primaryEmailAddress?.emailAddress || "—"}</p>
        </div>
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">To update your profile, visit the Profile page. Account settings are managed through Clerk.</p>
        </div>
      </div>
    </div>
  );
}
