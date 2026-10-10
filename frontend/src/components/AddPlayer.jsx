import { useState } from "react";

function AddPlayer(){

const [name, setName] = useState("")
const [position, setPosition] = useState("")
const [number, Setnumber] = useState("")
const [message, setMessage] = useState("")

const Addplayers = async () => {
  const  response = await fetch("http://127.0.0.1:8000/addplayer",{
    method: "POST",
    headers:{
      "content-type":"application/json"
    },
    body:JSON.stringify({
      name : name,
      position: position,
      number: number
    }),
  })
   const data = await response.json()

        console.log(data)

        setMessage(data.message)
}

return(
  <>
  
  <h1>ADD NEW PLAYER</h1>
  <label>Player Name:</label>
  <input
    value={name}
    onChange={(event) => setName(event.target.value)}
  ></input>
  <label>Position:</label>
  <input 
    value={position}
    onChange={(event) => setPosition(event.target.value)}
  ></input>
  <label>Shirt Number:</label>
  <input
    value={number}
    onChange={(event) => Setnumber(event.target.value)}
  ></input><br></br>
  <button onClick={Addplayers}>Add Player</button><br></br>
  <p>{message}</p>
 
  </>
)
}


export default AddPlayer