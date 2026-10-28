import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignIn, useSignUp, useUser } from "@clerk/clerk-react";
import herofootball from "../assets/football-hero.png";
import coach from "../assets/coach-icon.png";
import player from "../assets/player-icon.png";
import googleIcon from "../assets/google.svg";

const inputClass = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500";

function CoachRegister() {
  const navigate = useNavigate();
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const [mode, setMode] = useState("signin");
  const [userType, setUserType] = useState(() => sessionStorage.getItem("propitch_google_role") || "coach");
  const [username, setUsername] = useState(() => sessionStorage.getItem("propitch_google_username") || "");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showGoogleUsername, setShowGoogleUsername] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [signInVerificationPending, setSignInVerificationPending] = useState(false);
  const [usePasswordSignIn, setUsePasswordSignIn] = useState(false);
  const [signedInRoleFallback, setSignedInRoleFallback] = useState("");
  const [roleMismatch, setRoleMismatch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const isReady = signInLoaded && signUpLoaded;
  const resetMessage = () => { setError(""); setStatus(""); };
  const goToRole = (role) => navigate(role === "coach" ? "/coach" : "/player", { replace: true });
  const clerkError = (value, fallback) => value.errors?.[0]?.longMessage || fallback;
  const isUsernameTaken = (value) => value.errors?.some((item) => item.code === "form_identifier_exists");
  const toClerkUsername = (role, value) => `${role}_${value.trim().toLowerCase()}`;

  useEffect(() => {
    if (!userLoaded || !isSignedIn || !user) return;
    if (sessionStorage.getItem("propitch_logout_pending") === "true") return;

    const pendingUsername = sessionStorage.getItem("propitch_google_username");
    const pendingRole = sessionStorage.getItem("propitch_google_role");
    const pendingGoogleMode = sessionStorage.getItem("propitch_google_mode");
    const storedRole = user.unsafeMetadata?.role || user.publicMetadata?.role;
    const selectedRole = pendingRole || userType;
    const role = storedRole || (pendingGoogleMode === "signup" ? pendingRole : null) || signedInRoleFallback || userType;

    const finishAuthentication = async () => {
      try {
        if (pendingUsername && !user.username && pendingGoogleMode === "signup") {
          await user.update({ username: toClerkUsername(pendingRole || userType, pendingUsername) });
        }
        if (pendingRole && pendingGoogleMode === "signup" && !storedRole) {
          await user.updateMetadata({ unsafeMetadata: { role: pendingRole } });
        }
        if (storedRole && storedRole !== selectedRole) {
          setRoleMismatch(`This account is registered as a ${storedRole}. Select ${storedRole} to continue.`);
          return;
        }
        if (role) {
          sessionStorage.removeItem("propitch_logout_pending");
          sessionStorage.removeItem("propitch_google_username");
          sessionStorage.removeItem("propitch_google_role");
          sessionStorage.removeItem("propitch_google_mode");
          navigate(role === "coach" ? "/coach" : "/player", { replace: true });
        }
      } catch (updateError) {
        setError(clerkError(updateError, "Unable to finish your profile."));
      }
    };

    finishAuthentication();
  }, [isSignedIn, navigate, signedInRoleFallback, signUp, signUpLoaded, user, userLoaded, userType]);

  const googleSignupPending = signUpLoaded && signUp.status === "missing_requirements" && Boolean(sessionStorage.getItem("propitch_google_username"));

  const finishGoogleSignup = async (event) => {
    event.preventDefault();
    resetMessage();
    try {
      const selectedUsername = username.trim();
      if (!selectedUsername) {
        setError("Choose a username before continuing.");
        return;
      }
      const pendingRole = sessionStorage.getItem("propitch_google_role") || userType;
      const result = await signUp.update({ username: toClerkUsername(pendingRole, selectedUsername), unsafeMetadata: { role: pendingRole, appUsername: selectedUsername } });
      if (result.status === "complete") {
        await setSignUpActive({ session: result.createdSessionId });
        sessionStorage.removeItem("propitch_google_username");
        sessionStorage.removeItem("propitch_google_role");
        goToRole(pendingRole);
      }
    } catch (googleSignupError) {
      setError(isUsernameTaken(googleSignupError) ? "That username is already taken. Choose another username." : clerkError(googleSignupError, "Unable to finish your Google signup."));
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault(); resetMessage();
    sessionStorage.removeItem("propitch_logout_pending");
    try {
      if (usePasswordSignIn) {
        const signInIdentifier = identifier.includes("@") ? identifier.trim() : toClerkUsername(userType, identifier);
        const result = await signIn.create({ identifier: signInIdentifier, password });
        if (result.status === "complete") {
          await setSignInActive({ session: result.createdSessionId });
          setSignedInRoleFallback(userType);
        }
        return;
      }
      const signInIdentifier = identifier.includes("@") ? identifier.trim() : toClerkUsername(userType, identifier);
      const signInAttempt = await signIn.create({ identifier: signInIdentifier });
      const emailCodeFactor = signInAttempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
      if (!emailCodeFactor) {
        setError("Email-code sign-in is not enabled for this Clerk application. Enable Email verification code under Clerk Dashboard > User & authentication > Email, phone, username.");
        return;
      }
      await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailCodeFactor.emailAddressId });
      setSignInVerificationPending(true);
      setStatus("A sign-in code has been sent to your email.");
    } catch (signInError) { setError(clerkError(signInError, "Unable to sign in.")); }
  };

  const resendSignInCode = async () => {
    resetMessage();
    try {
      const emailCodeFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
      if (!emailCodeFactor) {
        setError("Clerk no longer has an email-code factor for this account. Start sign-in again.");
        return;
      }
      await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: emailCodeFactor.emailAddressId });
      setStatus("A new sign-in code has been sent to your email.");
    } catch (signInError) { setError(clerkError(signInError, "Unable to resend the sign-in code.")); }
  };

  const verifySignIn = async (event) => {
    event.preventDefault(); resetMessage();
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "email_code", code: verificationCode });
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        sessionStorage.removeItem("propitch_logout_pending");
        setSignedInRoleFallback(userType);
      }
    } catch (signInError) { setError(clerkError(signInError, "That sign-in code is not valid.")); }
  };

  const handleSignUp = async (event) => {
    event.preventDefault(); resetMessage();
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    try {
      await signUp.create({ username: toClerkUsername(userType, username), emailAddress: email, password, unsafeMetadata: { role: userType, appUsername: username.trim() } });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerificationPending(true); setStatus("Check your email for the verification code.");
    } catch (signUpError) {
      setError(isUsernameTaken(signUpError) ? "That username is already taken. Choose another username." : clerkError(signUpError, "Unable to create your account."));
    }
  };

  const verifyEmail = async (event) => {
    event.preventDefault(); resetMessage();
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: verificationCode });
      if (result.status === "complete") { await setSignUpActive({ session: result.createdSessionId }); goToRole(userType); }
    } catch (verificationError) { setError(clerkError(verificationError, "That verification code is not valid.")); }
  };

  const handleForgotPassword = async () => {
    resetMessage();
    if (!identifier) { setError("Enter your username or email first."); return; }
    try {
      const resetIdentifier = identifier.includes("@") ? identifier.trim() : toClerkUsername(userType, identifier);
      await signIn.create({ identifier: resetIdentifier });
      await signIn.prepareFirstFactor({ strategy: "reset_password_email_code" });
      setStatus("Password reset instructions have been sent to your email.");
    } catch (resetError) { setError(clerkError(resetError, "Unable to start password recovery.")); }
  };

  const handleGoogle = async () => {
    resetMessage();
    sessionStorage.removeItem("propitch_logout_pending");
    if (mode === "signin") {
      sessionStorage.setItem("propitch_google_role", userType);
      sessionStorage.setItem("propitch_google_mode", "signin");
      try {
        await signIn.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/account", oidcPrompt: "select_account" });
      } catch (googleError) {
        sessionStorage.removeItem("propitch_google_role");
        sessionStorage.removeItem("propitch_google_mode");
        setError(clerkError(googleError, "Unable to continue with Google."));
      }
      return;
    }
    if (!showGoogleUsername) { setShowGoogleUsername(true); return; }
    if (!username.trim()) { setError("Choose a username before continuing with Google."); return; }
    sessionStorage.setItem("propitch_google_username", username.trim());
    sessionStorage.setItem("propitch_google_role", userType);
    sessionStorage.setItem("propitch_google_mode", "signup");
    try {
      await signUp.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/account", unsafeMetadata: { role: userType } });
    } catch (googleError) {
      sessionStorage.removeItem("propitch_google_username");
      sessionStorage.removeItem("propitch_google_role");
      sessionStorage.removeItem("propitch_google_mode");
      setError(clerkError(googleError, "Unable to continue with Google."));
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat md:flex md:flex-row" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${herofootball})` }}>
      <div className="flex min-h-[38vh] w-full flex-col items-center justify-center px-5 py-8 text-center text-white md:min-h-screen md:w-1/2 md:items-start md:px-10 md:py-10 md:text-left">
        <div className="mb-7 md:mb-10"><h2 className="text-3xl font-bold"><span className="text-white">Pr⚽</span><span className="text-green-500">Pitch</span></h2></div>
        <h1 className="max-w-lg text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">Unleash Your Potential.<br />Join the elite network of players and coaches.</h1>
      </div>
      <div className="flex w-full min-w-0 flex-col justify-center px-4 pb-6 sm:px-6 md:min-h-screen md:w-1/2 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-xl rounded-3xl bg-white p-4 shadow-xl sm:p-6 md:p-8">
          <div className="flex w-full gap-2 rounded-full border border-gray-300 bg-gray-100 p-1">
            {[["signin", "Sign In"], ["signup", "Sign Up"]].map(([value, label]) => <button key={value} type="button" onClick={() => { setMode(value); setVerificationPending(false); resetMessage(); }} className={`flex-1 rounded-full p-3 text-center text-sm font-medium ${mode === value ? "border border-gray-400 bg-gray-300 text-gray-900" : "border border-transparent bg-white text-gray-600"}`}>{label}</button>)}
            </div>
          <div className="mt-4 flex w-full gap-3">
            {[ ["coach", coach, "Coach", "Manage your team"], ["player", player, "Player", "Track your stats"] ].map(([type, image, title, description]) => <button key={type} type="button" onClick={() => { setUserType(type); setRoleMismatch(""); }} aria-pressed={userType === type} className={`flex-1 min-w-0 rounded-2xl border-2 p-3 text-center sm:p-4 ${userType === type ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}`}><img src={image} alt={title} className="mx-auto h-16 w-16 object-contain" /><h3 className="text-base font-semibold text-gray-800">{title}</h3><p className="mt-1 text-xs text-gray-500">{description}</p></button>)}
          </div>
           {roleMismatch && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="alert">{roleMismatch}</p>}
          {googleSignupPending ? <form onSubmit={finishGoogleSignup} className="mt-4"><p className="mb-3 text-sm text-green-700" role="status">{status}</p><label htmlFor="googleSignupUsername" className="text-sm font-medium text-gray-700">Choose your username</label><input id="googleSignupUsername" value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} placeholder="Choose a unique username" minLength="3" required /><button type="submit" disabled={!isReady} className="mt-5 w-full rounded-full bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700">Finish Google signup</button></form> : verificationPending ? <form onSubmit={verifyEmail} className="mt-4"><p className="mb-3 text-sm text-green-700" role="status">{status}</p><label htmlFor="verificationCode" className="text-sm font-medium text-gray-700">Email verification code</label><input id="verificationCode" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} className={inputClass} placeholder="Enter the code from your email" required /><button type="submit" disabled={!isReady} className="mt-5 w-full rounded-full bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700">Verify email and continue</button></form> : signInVerificationPending ? <form onSubmit={verifySignIn} className="mt-4"><p className="mb-3 text-sm text-green-700" role="status">{status}</p><label htmlFor="signInVerificationCode" className="text-sm font-medium text-gray-700">Sign-in code</label><input id="signInVerificationCode" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} className={inputClass} placeholder="Enter the code from your email" required /><button type="submit" disabled={!isReady} className="mt-5 w-full rounded-full bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700">Verify code and continue</button><button type="button" onClick={resendSignInCode} className="mt-3 w-full text-sm font-semibold text-green-700 underline">Resend code</button></form> : <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="mt-4">
            {mode === "signup" ? <><label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="Enter your email" required /><label htmlFor="username" className="mt-3 block text-sm font-medium text-gray-700">Username</label><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} placeholder="Choose a username" minLength="3" required /></> : <><label htmlFor="identifier" className="text-sm font-medium text-gray-700">Username or Email Address</label><input id="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className={inputClass} placeholder="Enter your username or email" autoComplete="username" required /></>}
            {(mode === "signup" || (mode === "signin" && usePasswordSignIn)) && <><label htmlFor="password" className="mt-3 block text-sm font-medium text-gray-700">Password</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Enter your password" required /></>}
            {mode === "signup" && <><label htmlFor="confirmPassword" className="mt-3 block text-sm font-medium text-gray-700">Confirm Password</label><input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} placeholder="Confirm your password" required /></>}
            {mode === "signin" && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold"><button type="button" onClick={handleForgotPassword} className="text-left text-green-700 underline hover:text-green-800">Forgot Password?</button><button type="button" onClick={() => { setUsePasswordSignIn(!usePasswordSignIn); resetMessage(); }} className="text-left text-gray-600 underline hover:text-green-700">{usePasswordSignIn ? "Use email code instead" : "Use password instead"}</button></div>}
            {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}{status && <p className="mt-3 text-sm text-green-700" role="status">{status}</p>}
            <button type="submit" disabled={!isReady} className="mt-5 w-full rounded-full bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">{mode === "signin" ? `Sign In as ${userType === "coach" ? "Coach" : "Player"}` : "Create Account"}</button>
          </form>}
          {!googleSignupPending && !verificationPending && !signInVerificationPending && <>{mode === "signup" && <div className="mt-3">{showGoogleUsername && <><label htmlFor="googleUsername" className="text-sm font-medium text-gray-700">Username for your Google account</label><input id="googleUsername" value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} placeholder="Choose a username" required /></>}</div>}<button type="button" onClick={handleGoogle} disabled={!isReady} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm text-gray-700 hover:text-green-700"><img src={googleIcon} alt="" className="h-4 w-4" />Continue with Google</button></>}
          <p className="mt-3 text-center text-sm text-gray-600">{mode === "signin" ? <>Don't have an account? <button type="button" onClick={() => setMode("signup")} className="font-semibold text-green-700 underline">Sign Up</button></> : <>Already have an account? <button type="button" onClick={() => setMode("signin")} className="font-semibold text-green-700 underline">Sign In</button></>}</p>
          {mode === "signup" && <p className="mt-4 text-center text-xs text-gray-600">By signing up, you agree to our <Link to="/terms" className="font-medium text-green-700 underline">Terms of Service</Link> and <Link to="/privacy" className="font-medium text-green-700 underline">Privacy Policy</Link>.</p>}
        </div>
      </div>
    </div>
  );
}

export default CoachRegister;
