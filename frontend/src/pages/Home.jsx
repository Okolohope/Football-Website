import {Link} from "react-router-dom"
import herofootball from "../assets/football-hero.png"
import About from"../components/About"
import Feautures from "../components/Features"

function Home() {
  return(
    <div style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${herofootball})`}}>
      {/* Navbar */}
      <nav className="flex item-center justify-between px-8 py-5">
        <h2 className="text-2xl font-bold text-white">Pr⚽<span className="text-green-600">Pitch</span></h2>

        <div className="flex gap-8 text-white">
          <Link to="/" className="transiton hover:scale-145">Home</Link>
          <a href="#about" className="transiton hover:scale-145">About</a>

          <a href="#features" className="transiton hover:scale-145">Features</a>
          <Link to="/login" className="rounded-lg bg-green-600 px-5 py-2 font-semibold text-white transition hover:bg-green-700 hover:scale-105">Login</Link>
        </div>

       

      </nav>

      
        

      {/* Hero */}

      <section className="flex min-h-[600px] flex-col items-center justify-center px-6 text-center" >
        <h1 className="text-5xl font-bold text-white">Your Football Journey <span className="text-green-600">Starts Here</span></h1>
        <p className="mt-6 max-w-2xl text-lg text-white">
          Connect players, teams, and <span className="text-green-600">opportunites in one platform</span>
        </p>
        <div className="mt-8 flex gap-4">
          <Link to="/player/register" className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 hover:scale-105">Join as Player</Link>
          <Link to="/coach/register " className="rounded-lg border border-green-600 px-6 py-3 font-semibold text-green-600 transition hover:bg-black-700 hover:scale-105">Create a Team</Link>
        </div>
      </section>

      <About/>

      
      <Feautures/>
      {/* Call to Action */}
      <section className="bg-green-300 px-66 py-24 text-center text-white">
        <h2 className="text-4xl font-bold">Ready to Take the Next Step?</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-green-50">Join players and teams building their football journey on ProPitch </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/player/register" className="rounded-lg bg-white px-6 py-3 font-semibold text-green-600">Join as Player</Link>
          <Link to="/coach/register" className="rounded-lg border border-white px-6 py-3 font-semibold text-white">Create a Team</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 px-6 py-12 text-white">
        <div classNmae="mx-auto max-w-6xl">
         <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
           <h2 className="text-2xl font-bold">ProPitch</h2>
           <p className="mt-2 text-gray-400">Players.Teams.Opportunities</p>
         </div>
         <div className="flex gap-6">
           <Link to="/" className="text-gray-300 hover:text-white">Home</Link>
           <a href="#about" className="text-gray-300 hover:text-white">About</a>

           <a href="#features" className="text-gray-300 hover:text-white">Features</a>
           <Link to="/login"  className="text-gray-300 hover:text-white">Login</Link>
         </div>
        </div>

        <div className="mt-10 border-t border-gray-800 pt-6 text-center text-sm text-gray-400">
             2026 ProPitch
        </div>
      </footer>
    </div>
  )
}

export default Home