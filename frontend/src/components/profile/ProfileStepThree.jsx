import ProfileField from "./ProfileField";

function ProfileStepThree({ profile, errors, inputClass, styles, strengths, onChange, onToggle }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">Tell us about yourself</h2><p className="mt-1 text-sm text-slate-400">Share your story, strengths, and goals.</p></div>
      <ProfileField label="Short bio" error={errors.bio}><textarea className={`${inputClass} min-h-28 resize-y`} value={profile.bio} onChange={(event) => onChange("bio", event.target.value)} maxLength={200} placeholder="Tell coaches about your experience..." /><span className="mt-1 block text-right text-xs text-slate-500">{profile.bio.length}/200</span></ProfileField>
      <TagPicker label="Playing style" values={styles} selected={profile.playingStyle} onToggle={(value) => onToggle("playingStyle", value)} />
      <TagPicker label="Strengths" values={strengths} selected={profile.strengths} onToggle={(value) => onToggle("strengths", value)} />
      <ProfileField label="Football ambitions" error={errors.ambitions}><textarea className={`${inputClass} min-h-24 resize-y`} value={profile.ambitions} onChange={(event) => onChange("ambitions", event.target.value)} maxLength={320} placeholder="What are you working towards?" /></ProfileField>
    </div>
  );
}

function TagPicker({ label, values, selected, onToggle }) {
  return <div><p className="mb-2 text-sm font-medium text-slate-200">{label} <span className="text-slate-500">(optional)</span></p><div className="flex flex-wrap gap-2">{values.map((item) => <button key={item} type="button" onClick={() => onToggle(item)} className={`rounded-full border px-3 py-2 text-xs transition ${selected.includes(item) ? "border-emerald-400 bg-emerald-400/15 text-emerald-300" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>{item}</button>)}</div></div>;
}

export default ProfileStepThree;
