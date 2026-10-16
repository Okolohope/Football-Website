import { useState } from "react"
import {Link} from "react-router-dom"
import herofootball from "../assets/football-hero.png"
import About from"../components/About"
import Feautures from "../components/Features"

function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuClosing, setMenuClosing] = useState(false)

  const closeMenu = () => {
    setMenuClosing(true);
    
  
  }

  return(
    <div style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${herofootball})`}}>
      {/* Navbar */}
      <nav className="relative flex items-center justify-between px-8 py-5">
        <h2 className="text-2xl font-bold text-white">Pr⚽<span className="text-green-600">Pitch</span></h2>
        <button onClick={() => {
          setMenuClosing(false);
          setMenuOpen(!menuOpen);
        }} className="text-3xl text-white md:hidden ">☰</button>

        <div className="hidden gap-8 text-white md:flex">
          <Link to="/" className="transiton hover:scale-145">Home</Link>
          <a href="#about" className="transiton hover:scale-145">About</a>

          <a href="#features" className="transiton hover:scale-145">Features</a>
          <Link to="/login" className="rounded-lg bg-green-600 px-5 py-2 font-semibold text-white transition hover:bg-green-700 hover:scale-105">Login</Link>
        </div>
        {/* Mobile Navigation Menu */}
        {(menuOpen  || menuClosing) &&(
          <div 
          onAnimationEnd={() => {
            if (menuClosing) {
              setMenuOpen(false);
              setMenuClosing(false);
            }
          }}
          className={`fixed right-0 top-0 z-50 flex w-64 flex-col gap-2 rounded-bl-2xl bg-white p-5 text-gray-800 shadow-xl md:hidden ${menuClosing ? "menu-slide-out":"menu-slide-in" }`}>
            <div className="flex justify-end">
              <button
              onClick={closeMenu} className="text-3xl text-gray-700 hover:text-green-700" aria-label="Close menu">x</button>
            </div>
            <Link to="/" onClick={() => {
              setMenuClosing(true);
              setMenuOpen(false)
            }} className="rounded-lg px-4 py-3 font-medium transition hover:bg-green-50 hover:text-green-700">Home</Link>
            <a href="#about" onClick={closeMenu} className="rounded-lg px-4 py-3 font-medium transition hover:bg-green-50 hover:text-green-700">About</a>
            <a href="#features" onClick={closeMenu} className="rounded-lg px-4 py-3 font-medium transition hover:bg-green-50 hover:text-green-700">Features</a>
            <Link to="/coach/register" onClick={closeMenu} className="mt-2 rounded-lg bg-green-600 px-4 py-3 text-center font-semibold text-white transition hover:bg-green-700">Login</Link>
          </div>
        )}
       

      </nav>

      
        

      {/* Hero */}

      <section className="flex min-h-[600px] flex-col items-center justify-center px-6 text-center" >
        <h1 className="text-3xl font-bold text-white md:text-5xl">Your Football Journey <span className="text-green-600">Starts Here</span></h1>
        <p className="mt-6 max-w-2xl text-base text-white md:text-lg">
          Connect players, teams, and <span className="text-green-600">opportunites in one platform</span>
        </p>
        <div className="mt-8 flex gap-4">
          <Link to="/coach/register" className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 hover:scale-105">Join as Player</Link>
          <Link to="/coach/register " className="rounded-lg border border-green-600 px-6 py-3 font-semibold text-green-600 transition hover:bg-black-700 hover:scale-105">Create a Team</Link>
        </div>
      </section>

      <About/>

      
      <Feautures/>
      {/* Call to Action */}
      <section className="bg-green-300 px-4 sm:px-6 md:px-66 py-12 sm:py-16 md:py-24 text-center text-white">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Ready to Take the Next Step?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base md:text-lg">Join players and teams building their football journey on ProPitch </p>

        <div className="mt-6 sm:mt-8 flex flex-row items-center justify-center gap-3 sm:gap-4">
          <Link to="/player/register" className="rounded-lg bg-white px-4 py-2 sm: py-3 text-sm sm:text-base font-semibold text-green-600">Join as Player</Link>
          <Link to="/coach/register" className="rounded-lg border border-white px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-white">Create a Team</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 px-6 py-4 sm:px-6 py-8 sm:py-12 text-white">
        <div classNmae="mx-auto max-w-6xl">
         <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
           <h2 className="text-2xl font-bold">ProPitch</h2>
           <p className="mt-2 text-gray-400">Players.Teams.Opportunities</p>
         </div>
         <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 w-full md:w-auto">
           <Link to="/" className="text-sm text-gray-300 hover:text-white">Home</Link>
           <a href="#about" className="text-sm text-gray-300 hover:text-white">About</a>

           <a href="#features" className="text-sm text-gray-300 hover:text-white">Features</a>
           <Link to="/login"  className="text-sm text-gray-300 hover:text-white">Login</Link>
         </div>
        </div>

        <div className="mt-8 sm:mt-10 border-t border-gray-800 pt-5 text-center text-xs sm:text-sm text-gray-400">
             2026 ProPitch
        </div>
      </footer>
    </div>
  )
}

export default Home