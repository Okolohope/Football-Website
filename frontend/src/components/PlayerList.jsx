import {useState} from "react"
  
function PlayerList(){
  const[players, setPlayers] = useState([])

  const seePlayers = async () => {
  const response = await fetch("http://127.0.0.1:8000/players");
  
  const data = await response.json();
  console.log(data);

  setPlayers(data.team_squad)
  }
  return(
    <div>
    
    <button onClick={seePlayers}>SEE PLAYERS</button>
    {
      players.map((player) => (
        <div key={player.id}>
          <p>{player.name}</p>
          <p>{player.position}</p>
          
          </div>
      ))
    }
  </div>
  
  )
}

export default PlayerList