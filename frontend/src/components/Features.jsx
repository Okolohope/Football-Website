

import icon4 from "../assets/4.svg"
import icon5 from "../assets/5.svg"
import icon6 from "../assets/6.svg"
import icon7 from "../assets/7.svg"

function Feautures(){
  return(
    <section id="features" className="bg-gray-200 px-4 sm:px-6 py-12 sm:py-16 md:py-24">
       <div className="mx-auto mahttp://localhost:5173/x-w-6xl text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Everything You Need in One Place</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base md:text-lg text-gray-600">
          From building your profile to finding your next opportunity,ELEVN gives you the tools to grow.
        </p>
          <div className="mt-8 sm:mt-12 grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div className="rounded-2xl bg-green-200 p-8">

              <div>
                <img src={icon4} alt="" className="mx-auto block h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16 md:h-20 md:w-20" />
              </div>
              
              <h3 className="text-base sm:text-lg md:text-xl font-bold">Player Profiles</h3>
              <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base md:text-lg text-gray-600">
              Showcase your skills,stats,and achievements to get noticed.
              </p>
            </div>

            <div className="rounded-2xl bg-green-200 p-8"> 
              <div>
                <img src={icon5} alt="" className="mx-auto block h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16 md:h-20 md:w-20" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold">Team Management</h3>
              <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base md:text-lg text-gray-600">
              Create and manage your team, add players, and track progress.
              </p>
            </div>

            <div className="rounded-2xl bg-green-200 p-8">
              <div>
                <img src={icon6} alt="" className="mx-auto block h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16 md:h-20 md:w-20" />
              </div>
              
              <h3 className="text-base sm:text-lg md:text-xl font-bold">Discover Talent</h3>
              <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base md:text-lg text-gray-600">Find players and teams that match your goals and needs</p>
            </div>

            <div className="rounded-2xl bg-green-200 p-8">
              <div>
                <img src={icon7} alt="" className="mx-auto block h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16 md:h-20 md:w-20" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold">Opportunities</h3>
              <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base md:text-lg text-gray-600">Find matches, join tournaments,attend trials, and connect with scouts.</p>
            </div>
          </div>
        </div>
      </section>
  )
}

export default Feautures