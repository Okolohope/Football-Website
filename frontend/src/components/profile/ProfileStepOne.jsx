import ProfileField from "./ProfileField";
import ProfilePhotoPicker from "./ProfilePhotoPicker";

function ProfileStepOne({ profile, errors, inputClass, onChange, onPhotoChange, photoPreview }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold">Let&apos;s get to know you</h2><p className="mt-1 text-sm text-slate-400">Add your basic details so teams know who you are.</p></div>
      <ProfilePhotoPicker preview={photoPreview} onChange={onPhotoChange} />
      <ProfileField label="Full name" error={errors.fullName}><input className={inputClass} value={profile.fullName} onChange={(event) => onChange("fullName", event.target.value)} maxLength={80} placeholder="Alex Johnson" /></ProfileField>
      <ProfileField label="Nickname (optional)"><input className={inputClass} value={profile.nickname} onChange={(event) => onChange("nickname", event.target.value)} maxLength={40} placeholder="Alex" /></ProfileField>
      <div className="grid gap-5 sm:grid-cols-2">
        <ProfileField label="Age group"><select className={inputClass} value={profile.ageGroup} onChange={(event) => onChange("ageGroup", event.target.value)}><option>Under 15</option><option>15-17</option><option>18-21</option><option>22+</option></select></ProfileField>
        <ProfileField label="Gender"><select className={inputClass} value={profile.gender} onChange={(event) => onChange("gender", event.target.value)}><option>Male</option><option>Female</option><option>Prefer not to say</option></select></ProfileField>
        <ProfileField label="Country"><input className={inputClass} value={profile.country} onChange={(event) => onChange("country", event.target.value)} maxLength={60} /></ProfileField>
        <ProfileField label="City / state" error={errors.city}><input className={inputClass} value={profile.city} onChange={(event) => onChange("city", event.target.value)} maxLength={80} placeholder="Lagos" /></ProfileField>
      </div>
    </div>
  );
}

export default ProfileStepOne;
