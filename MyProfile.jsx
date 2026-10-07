// src/pages/MyProfile.jsx
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants";

export default function MyProfile() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-center">
      <h1 className="text-3xl font-extrabold mb-4">My Profile</h1>
      <p className="text-muted-foreground mb-6">Update your interview profile details</p>
      <button onClick={() => navigate(ROUTES.PROFILE)} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold">Edit Profile</button>
    </div>
  );
}
