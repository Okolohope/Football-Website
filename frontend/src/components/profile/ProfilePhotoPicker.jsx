function ProfilePhotoPicker({ preview, onChange }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400 bg-slate-950/60 text-xs text-slate-500">
        {preview ? <img src={preview} alt="Profile preview" className="h-full w-full object-cover" /> : "No photo"}
      </div>
      <label className="cursor-pointer rounded-xl border border-emerald-400/60 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10">
        Add photo
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} />
      </label>
      <span className="text-xs text-slate-400">JPG, PNG or WebP up to 5 MB</span>
    </div>
  );
}

export default ProfilePhotoPicker;
