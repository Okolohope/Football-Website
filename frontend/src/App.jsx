import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import CreateTeam from "./pages/CreateTeam";
import CoachDashboard from "./pages/CoachDashboard";
import CoachRegister from "./pages/CoachRegister";
import PlayerDashboard from "./pages/PlayerDashboard";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import RequireAuth from "./components/RequireAuth";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CoachOnboarding from "./pages/CoachOnboarding";

function App(){
  return(
   

    <Routes>

      <Route path="/"element={<Home/>}/>
      <Route path="/account" element={<CoachRegister/>}/>
      <Route path="/login" element={<CoachRegister/>}/>
      <Route path="/coach/onboarding" element={<RequireAuth><CoachOnboarding/></RequireAuth>}/>
      <Route path="/terms" element={<TermsOfService/>}/>
      <Route path="/privacy" element={<PrivacyPolicy/>}/>
      <Route path="/coach/create-team" element={<RequireAuth><CreateTeam/></RequireAuth>}/>
      <Route path="/coach" element={<RequireAuth><CoachDashboard/></RequireAuth>}/>
      <Route path="/coach/training" element={<RequireAuth><CoachDashboard/></RequireAuth>}/>
      <Route path="/coach/tournaments/:tournamentId" element={<RequireAuth><CoachDashboard/></RequireAuth>}/>
      <Route path="/coach/tournaments" element={<RequireAuth><CoachDashboard/></RequireAuth>}/>
      <Route path="/player" element={<RequireAuth><PlayerDashboard/></RequireAuth>}/>
      <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

    </Routes>
  
  )
}

export default App