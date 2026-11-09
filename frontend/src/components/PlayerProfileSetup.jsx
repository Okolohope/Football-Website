import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import ProfileStepOne from "./profile/ProfileStepOne";
import ProfileStepTwo from "./profile/ProfileStepTwo";
import ProfileStepThree from "./profile/ProfileStepThree";
import { initialProfile, playerStrengths, playingStyles } from "./profile/profileOptions";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

function PlayerProfileSetup({ onComplete }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const draftKey = `propitch_player_draft_${user?.id || "guest"}`;
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(() => loadDraft(draftKey));
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => localStorage.setItem(draftKey, JSON.stringify(profile)), [draftKey, profile]);
  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

  const update = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };
  const toggle = (key, value) => update(key, profile[key].includes(value) ? profile[key].filter((item) => item !== value) : [...profile[key], value]);
  const validate = () => {
    const nextErrors = {};
    if (step === 1) {
      if (profile.fullName.trim().length < 2 || profile.fullName.trim().length > 80) nextErrors.fullName = "Enter a name between 2 and 80 characters.";
      if (!profile.city.trim() || profile.city.trim().length > 80) nextErrors.city = "Enter your city (maximum 80 characters).";
    }
    if (step === 2 && !profile.primaryPosition) nextErrors.primaryPosition = "Choose your primary position.";
    if (step === 3) {
      if (profile.bio.length > 200) nextErrors.bio = "Keep your short bio under 200 characters.";
      if (profile.ambitions.length > 320) nextErrors.ambitions = "Keep your ambitions under 320 characters.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setServerError("Choose an image smaller than 5 MB.");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setServerError("");
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setServerError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      let avatar = { key: profile.avatarKey, url: "" };
      if (photo) {
        const formData = new FormData();
        formData.append("avatar", photo);
        const uploadResponse = await fetch(`${API_URL}/api/player/avatar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
        if (!uploadResponse.ok) throw new Error(await errorMessage(uploadResponse, "We could not upload your photo."));
        avatar = await uploadResponse.json();
      }
      const nextProfile = { ...profile, avatarKey: avatar.key };
      const response = await fetch(`${API_URL}/api/player/profile`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(nextProfile) });
      if (!response.ok) throw new Error(await errorMessage(response, "We could not save your profile."));
      localStorage.removeItem(draftKey);
      onComplete({ ...nextProfile, avatarUrl: avatar.url || photoPreview });
    } catch (error) {
      setServerError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const progress = useMemo(() => (step / 3) * 100, [step]);
  const stepProps = { profile, errors, inputClass, onChange: update };

  return <main className="min-h-screen bg-[#061a2b] px-4 py-8 text-white sm:px-8"><section className="mx-auto max-w-3xl"><div className="mb-8 flex items-center justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">ProPitch</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Build your player profile</h1><p className="mt-2 text-slate-400">Help coaches discover what makes you unique.</p></div><span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">Step {step} of 3</span></div><div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div><div className="rounded-3xl border border-slate-700 bg-[#0b2439] p-5 shadow-2xl sm:p-8">{step === 1 && <ProfileStepOne {...stepProps} onPhotoChange={selectPhoto} photoPreview={photoPreview || profile.avatarUrl} />}{step === 2 && <ProfileStepTwo {...stepProps} />}{step === 3 && <ProfileStepThree {...stepProps} styles={playingStyles} strengths={playerStrengths} onToggle={toggle} />}{serverError && <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{serverError}</p>}<div className="mt-8 flex justify-between gap-3"><button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || saving} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 disabled:invisible">Back</button>{step < 3 ? <button type="button" onClick={() => validate() && setStep((current) => current + 1)} className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300">Next: Continue</button> : <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Complete setup"}</button>}</div></div></section></main>;
}

function loadDraft(key) {
  try {
    return { ...initialProfile, ...JSON.parse(localStorage.getItem(key) || "null") };
  } catch {
    return initialProfile;
  }
}

async function errorMessage(response, fallback) {
  const message = await response.text();
  return message || fallback;
}

export default PlayerProfileSetup;
