import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

function RequireAuth({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return <div className="p-8 text-gray-700">Loading your session...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/account" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default RequireAuth;
