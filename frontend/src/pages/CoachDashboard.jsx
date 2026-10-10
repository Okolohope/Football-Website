import AddPlayer from "../components/AddPlayer"
import PlayerList from "../components/PlayerList"

function CoachDashboard(){
  return(
    <div>
      <h1>Coach Dashboard</h1>
      
      <AddPlayer/>
      <PlayerList/>
    </div>
  )
}
export default CoachDashboard