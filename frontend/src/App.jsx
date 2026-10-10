import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import CreateTeam from "./pages/CreateTeam";
import CoachDashboard from "./pages/CoachDashboard";
import CoachRegister from "./pages/CoachRegister";

function App(){
  return(
   

    <Routes>

      <Route path="/"element={<Home/>}/>
      <Route path="/coach/register"element={<CoachRegister/>}/>
      <Route path="/coach/create-team"element={<CreateTeam/>}/>
      <Route path="/coach"element={<CoachDashboard/>}/>

    </Routes>
  
  )
}

export default App