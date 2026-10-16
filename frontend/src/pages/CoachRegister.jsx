import { useState } from "react"
import herofootball from "../assets/football-hero.png"
import coach from "../assets/coach-icon.png"
import player from "../assets/player-icon.png"
function CoachRegister(){
  const [mode, setMode] = useState("signin")
  const [userType, setUserType] = useState("coach");

  return(


    <>
    <div className="flex min-h-screen  md:flex-row" >

      <div className="w-1/2  min-h-screen flex flex-col justify-center text-white p-6 md:p-10 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${herofootball})`}}>
        <div>
          <h2 className="text-3xl font-bold">
            <span className="text-white">Pr⚽</span><span className="text-green-500">Pitch</span>
          </h2>
        </div>

        <h1 className="text-white">
          Unleash Your Potential.
          Join the elite network of players and coaches.
        </h1>

        
      </div>

    
      <div className="w-1/2 min-w-0 p-3 sm:p-4 md:p-10 flex flex-col">
       <div className="flex w-full rounded-full border border-gray-300 p-1">
         <button onClick={() => setMode("signin")}
         
         className={`flex-1 rounded-full p-3 text-center ${
          mode === "signin" ? "border-gray-400 bg-gray-300": "border-gray-200 bg-white"
         }`}>
          Sign In</button>


         <button onClick={() => setMode("signup")}
         className={`flex-1 rounded-full p-3 text-center ${
          mode === "signup"? "border-gray-400 bg-gray-300": "border-gray-400 bg-white"
         }`}>
          Sign Up</button>

       </div>

       <div className="flex w-full gap-3 mt-4">
        <button 
        onClick={() => {setUserType("coach")}}
        className={`flex-1 min-w-0 rounded-2xl border-2 p-4 text-center ${
          userType === "coach" 
          ? "border-gray-400 bg-gray-300"
          : "border-gray-200 bg-white"
        }`}
          >
          <div>
            <img src={coach} alt="Coach" className="mx-auto h-16 w-16 object-contain" />
          </div>
          <h3 className="text-base font-semibold text-gray-800">Coach</h3>
          <p className="mt-1 text-xs text-gray-500">Manage your team </p>
        </button>
        <button onClick={() => setUserType("player")} className={`flex-1 min-w-0 rounded-2xl border-2 p-4 text-center ${userType === "player"?"border-gray-400 bg-gray-200": "border-gray-200 bg-white"}`}>
          <div>
            <img src={player} alt="Player" className="mx-auto h-16 w-16 object-contain" />
          </div>
          <h3 className="text-base font-semibold text-gray-800">Player</h3>
          <p className="mt-1 text-xs text-gray-500">Track your stats</p>
        </button>
       </div>

        <div>
         <label className="text-s, font-medium text-gray-700">Email or Phone</label><br/>
         <input type="text" placeholder="Enter your email  or phone " className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none"/><br/>

         <label className="text-s, font-medium text-gray-700" >Password</label><br/>
         <input type="password" placeholder="Enter your password" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none"/><br/>
         {mode === "signup" && (
          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700">Confirm Password</label>
            <input type="password" placeholder="Confirm Password" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none"/>
          </div>
         )}
         {mode === "signin" && (
          <button className="mt-1 block text-left text-xs text-gray-500">Forgot Password?</button>)}<br/>
         <button className="mt-4 w-full rounded-full bg-green-600 py-2 text-sm font-semibold text-white"> {mode === "signin" ? "Sign In" : "Create Account"}</button>
         <button className="mt-2 w-full py-1 text-xs text-gray-500">Or continue with Google</button>
         {mode === "signin" && (<button className="mt-2 w-full py-1 text-xs text-gray-500">Dont have an account? Sign Up</button>)}
        </div>

      </div>
    </div>
    </>
  )
}

export default CoachRegister