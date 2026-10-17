import { useState } from "react";
import herofootball from "../assets/football-hero.png";
import coach from "../assets/coach-icon.png";
import player from "../assets/player-icon.png";

function CoachRegister() {
  const [mode, setMode] = useState("signin");
  const [userType, setUserType] = useState("coach");

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat md:flex md:flex-row"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${herofootball})`,
      }}
    >
      {/* LEFT SIDE: LOGO AND HEADING */}
      <div className="flex min-h-[38vh] w-full flex-col items-center justify-center px-5 py-8 text-center text-white md:min-h-screen md:w-1/2 md:items-start md:px-10 md:py-10 md:text-left">
        <div className="mb-7 md:mb-10">
          <h2 className="text-3xl font-bold">
            <span className="text-white">Pr⚽</span>
            <span className="text-green-500">Pitch</span>
          </h2>
        </div>

        <div className="max-w-lg">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
            Unleash Your Potential.
            <br />
            Join the elite network of players and coaches.
          </h1>
        </div>
      </div>

      {/* RIGHT SIDE: REGISTRATION FORM */}
      <div className="flex w-full min-w-0 flex-col justify-center px-4 pb-6 sm:px-6 md:min-h-screen md:w-1/2 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-4 shadow-xl sm:p-6 md:p-8">
          {/* SIGN IN / SIGN UP TABS */}
          <div className="flex w-full gap-2 rounded-full border border-gray-300 bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-full p-3 text-center text-sm font-medium transition-colors ${
                mode === "signin"
                  ? "border border-gray-400 bg-gray-300 text-gray-900"
                  : "border border-transparent bg-white text-gray-600"
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-full p-3 text-center text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "border border-gray-400 bg-gray-300 text-gray-900"
                  : "border border-transparent bg-white text-gray-600"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* COACH / PLAYER SELECTION */}
          <div className="mt-4 flex w-full gap-3">
            <button
              type="button"
              onClick={() => setUserType("coach")}
              aria-pressed={userType === "coach"}
              className={`flex-1 min-w-0 rounded-2xl border-2 p-3 text-center transition-colors sm:p-4 ${
                userType === "coach"
                  ? "border-gray-400 bg-gray-200"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <img
                  src={coach}
                  alt="Coach"
                  className="mx-auto h-16 w-16 object-contain"
                />
              </div>

              <h3 className="text-base font-semibold text-gray-800">Coach</h3>

              <p className="mt-1 text-xs text-gray-500">Manage your team</p>
            </button>

            <button
              type="button"
              onClick={() => setUserType("player")}
              aria-pressed={userType === "player"}
              className={`flex-1 min-w-0 rounded-2xl border-2 p-3 text-center transition-colors sm:p-4 ${
                userType === "player"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <img
                  src={player}
                  alt="Player"
                  className="mx-auto h-16 w-16 object-contain"
                />
              </div>

              <h3 className="text-base font-semibold text-gray-800">Player</h3>

              <p className="mt-1 text-xs text-gray-500">Track your stats</p>
            </button>
          </div>

          {/* EMAIL OR PHONE */}
          <div className="mt-4">
            <label
              htmlFor="emailOrPhone"
              className="text-sm font-medium text-gray-700"
            >
              Email Address or Phone Number
            </label>

            <input
              id="emailOrPhone"
              type="text"
              autoComplete="username"
              placeholder="Enter your email or phone"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* PASSWORD */}
          <div className="mt-3">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              placeholder="Enter your password"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* CONFIRM PASSWORD: SIGN UP ONLY */}
          {mode === "signup" && (
            <div className="mt-3">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-gray-700"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
          )}

          {/* FORGOT PASSWORD: SIGN IN ONLY */}
          {mode === "signin" && (
            <button
              type="button"
              onClick={() =>
                alert("Password recovery will be connected later.")
              }
              className="mt-2 block text-left text-xs text-gray-500 hover:text-green-600"
            >
              Forgot Password?
            </button>
          )}

          {/* MAIN BUTTON */}
          <button
            type="button"
            onClick={() =>
              alert(
                mode === "signin"
                  ? "Coach/Player sign-in will be connected next."
                  : "Account creation will be connected next."
              )
            }
            className="mt-5 w-full rounded-full bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            {mode === "signin"
              ? `Sign In as ${userType === "coach" ? "Coach" : "Player"}`
              : "Create Account"}
          </button>

          {/* GOOGLE OPTION */}
          <button
            type="button"
            onClick={() =>
              alert("Google sign-in will be connected later.")
            }
            className="mt-3 w-full py-2 text-sm text-gray-600 transition hover:text-green-600"
          >
            <span className="mr-2 font-bold text-blue-600">G</span>
            Or continue with Google
          </button>

          {/* ACCOUNT SWITCHING */}
          <div className="mt-3 text-center text-sm text-gray-600">
            {mode === "signin" ? (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-green-600 hover:text-green-700"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-semibold text-green-600 hover:text-green-700"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoachRegister;
