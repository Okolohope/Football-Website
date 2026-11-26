import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import CreateTeam from "./pages/CreateTeam";
import CoachDashboard from "./pages/CoachDashboard";
import CoachRegister from "./pages/CoachRegister";
import PlayerDashboard from "./pages/PlayerDashboard";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/clerk-react";
import RequireAuth from "./components/RequireAuth";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { Navigate } from "react-router-dom";
import ElevenAppShell from "./components/ElevenAppShell";
import ElevenPlaceholderPage from "./pages/ElevenPlaceholderPage";
import ElevenFeed from "./pages/ElevenFeed";
import ElevenStats from "./pages/ElevenStats";
import ElevenTraining from "./pages/ElevenTraining";
import ElevenMessages from "./pages/ElevenMessages";
import ElevenSettings from "./pages/ElevenSettings";
import ElevenPlayerProfile from "./pages/ElevenPlayerProfile";
import ElevenPolicies from "./pages/ElevenPolicies";

function RootRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Navigate to="/feed" replace /> : <Home />;
}

function App(){
  return(
   

    <Routes>

      <Route path="/" element={<RootRoute />} />
      <Route path="/account" element={<CoachRegister/>}/>
      <Route path="/terms" element={<TermsOfService/>}/>
      <Route path="/privacy" element={<PrivacyPolicy/>}/>
      <Route path="/coach/create-team" element={<RequireAuth><CreateTeam/></RequireAuth>}/>
      <Route path="/coach" element={<RequireAuth><CoachDashboard/></RequireAuth>}/>
      <Route path="/player" element={<RequireAuth><PlayerDashboard/></RequireAuth>}/>
      <Route element={<RequireAuth><ElevenAppShell /></RequireAuth>}>
        <Route path="/feed" element={<ElevenFeed />} />
        <Route path="/stats" element={<ElevenStats />} />
        <Route path="/training" element={<ElevenTraining />} />
        <Route path="/messages" element={<ElevenMessages />} />
        <Route path="/settings" element={<ElevenSettings />} />
        <Route path="/player/:uuid" element={<ElevenPlayerProfile />} />
        <Route path="/clip/:id" element={<Navigate to="/feed" replace />} />
        <Route path="/post/:id" element={<Navigate to="/feed" replace />} />
        <Route path="/policies/nff" element={<ElevenPolicies />} />
      </Route>
      <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

    </Routes>
  
  )
}

export default App