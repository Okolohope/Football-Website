import ProfileField from "./ProfileField";

function ProfileStepTwo({ profile, errors, inputClass, onChange }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">Tell us how you play</h2><p className="mt-1 text-sm text-slate-400">This helps us match you with the right opportunities.</p></div>
      <ProfileField label="Primary position" error={errors.primaryPosition}><select className={inputClass} value={profile.primaryPosition} onChange={(event) => onChange("primaryPosition", event.target.value)}><option>Forward</option><option>Midfielder</option><option>Defender</option><option>Goalkeeper</option></select></ProfileField>
      <div className="grid gap-5 sm:grid-cols-2">
        <ProfileField label="Preferred foot"><select className={inputClass} value={profile.preferredFoot} onChange={(event) => onChange("preferredFoot", event.target.value)}><option>Left</option><option>Right</option><option>Both</option></select></ProfileField>
        <ProfileField label="Playing level"><select className={inputClass} value={profile.playingLevel} onChange={(event) => onChange("playingLevel", event.target.value)}><option>Academy</option><option>Amateur</option><option>Semi-professional</option><option>Professional</option></select></ProfileField>
      </div>
      <ProfileField label="Years playing"><select className={inputClass} value={profile.yearsPlaying} onChange={(event) => onChange("yearsPlaying", event.target.value)}><option>1</option><option>2</option><option>3</option><option>4+</option></select></ProfileField>
    </div>
  );
}

export default ProfileStepTwo;
