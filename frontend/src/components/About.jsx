import squad from "../assets/squad.jpg"
import icon1 from "../assets/1.svg"
import icon2 from "../assets/2.svg"
import icon3 from "../assets/3.svg"
function About(){
  return(
    
    <section id="about" className="bg-white px-6 py-24">
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <p className=" text-green-600 md:font-semibold">ABOUT PROPITCH</p>
          <h2 className="text-2xl font-bold md:text-4xl ">About ProPitch</h2>
          <h3>ProPitch is a football platform built to connect<br/> players,teams, and football opportunities.<br/>
      
          Players can build their profiles and showcase their abilities, while teams can manage their squads and discover talent </h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-xl bg-green-200 p-2 sm:p-6 text-center min-w-0">
              <div>
                <img src={icon1} alt="" className="mx-auto block h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16 md:h-20 md:w-20" />
              </div>
              <h3 className="text-xs sm:text-base font-semibold break-words">More Visibity</h3>
            </div>
            <div className="rounded-xl bg-green-200 p-2 sm:p-6 text-center min-w-0">
              <div>
                <img src={icon2} alt="" className="mx-auto block h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16 md:h-20 md:w-20" />
              </div>
              <h3 className="text-xs sm:text-base font-semibold break-words">Better Opportunities</h3>
            </div>
            <div className="rounded-xl bg-green-200 p-2 sm:p-6 text-center min-w-0">
              <div>
                <img src={icon3} alt="" className="mx-auto block h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16 md:h-20 md:w-20" />
              </div>
              <h3 className="text-xs sm:text-base font-semibold break-words">Stronger Communities</h3>
            </div>
          </div>
        </div>   

        
        
        <div>
          <img src={squad} alt="Football team"className="w-[400px] h-[300px] object-cover rounded-2xl"/>
        </div>
        
      </div>
    </section>

  )
}
export default About