import squad from "../assets/squad.jpg"
function About(){
  return(
    
    <section id="about" className="bg-white px-6 py-24">
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <p className="font-semibold text-green-600 ">ABOUT PROPITCH</p>
          <h2 className="text-4xl font-bold">About ProPitch</h2>
          <h3>ProPitch is a football platform built to connect<br/> players,teams, and football opportunities.<br/>
      
          Players can build their profiles and showcase<br/> their abilities, while teams can manage their squads<br/> and discover talent </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-green-200 p-8">
              <h3>More Visibity</h3>
            </div>
            <div className="rounded-xl bg-green-200 p-8">
              <h3>Better Opportunities</h3>
            </div>
            <div className="rounded-xl bg-green-200 p-8">
              <h3>Stronger Communities</h3>
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