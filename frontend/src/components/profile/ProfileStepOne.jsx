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
        <ProfileField label="Date of birth"><input type="date" className={inputClass} value={profile.dateOfBirth} onChange={(event) => onChange("dateOfBirth", event.target.value)} /></ProfileField>
        <ProfileField label="Phone number"><input type="tel" className={inputClass} value={profile.phoneNumber} onChange={(event) => onChange("phoneNumber", event.target.value)} maxLength={30} placeholder="+234 800 000 0000" /></ProfileField>
      </div>
      {profile.dateOfBirth && (new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()) < 18 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="mb-3 text-sm font-semibold text-amber-200">Guardian/parent details required for users under 18</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="Guardian full name"><input className={inputClass} value={profile.guardianName} onChange={(event) => onChange("guardianName", event.target.value)} maxLength={80} /></ProfileField>
            <ProfileField label="Guardian phone number"><input type="tel" className={inputClass} value={profile.guardianPhone} onChange={(event) => onChange("guardianPhone", event.target.value)} maxLength={30} /></ProfileField>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-200"><input type="checkbox" checked={profile.guardianConsent} onChange={(event) => onChange("guardianConsent", event.target.checked)} /> <span>I confirm that my parent or guardian has approved ELEVN account use.</span></label>
        </div>
      )}
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
