import AddPlayer from "../components/AddPlayer"
import PlayerList from "../components/PlayerList"
import AccountHeader from "../components/AccountHeader"

function CoachDashboard(){
  return(
    <div className="min-h-screen">
      <AccountHeader />
      <main className="p-8">
        <h1 className="text-3xl font-bold">Coach Dashboard</h1>
      
        <AddPlayer/>
        <PlayerList/>
      </main>
    </div>
  )
}
export default CoachDashboard