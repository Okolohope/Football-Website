import {Link} from "react-router-dom"

function CoachRegister() {
  return(
    <div>
      <h1>Coach Registration</h1>
      <p>Create your coach account</p>
      <input placeholder="Name"/>
      <input placeholder="Email"/>
      <input placeholder="Password"/>

      <Link to="/coach/create-team">
      <button>Register</button>
      </Link>
      
    </div>
  )
}

export default CoachRegister