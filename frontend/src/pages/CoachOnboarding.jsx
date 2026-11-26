import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { markCoachOnboardingComplete } from "../services/coachOnboardingState";
import { submitCoachOnboarding } from "../services/coach";

const ageGroups = [
  { value: "U13", label: "Under 13" },
  { value: "U15", label: "Under 15" },
  { value: "U17", label: "Under 17" },
  { value: "OPEN_SENIOR", label: "Open / Senior" },
  { value: "OTHER", label: "Other" },
];

const initialForm = {
  fullName: "",
  dateOfBirth: "",
  teamName: "",
  cityLocation: "",
  homeGroundPitch: "",
  ageGroup: "",
};

const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-600 focus:ring-2 focus:ring-green-600/15";
const maxDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10);

function CoachOnboarding() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (!logoPreview.startsWith("blob:")) return undefined;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSubmitted(false);
  };

  const selectLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((current) => ({ ...current, teamLogo: "Choose an image file." }));
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((current) => ({ ...current, teamLogo: "The logo must be 2 MB or smaller." }));
      event.target.value = "";
      return;
    }

    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
    setErrors((current) => ({ ...current, teamLogo: "" }));
    setSubmitted(false);
  };

  const removeLogo = () => {
    setLogo(null);
    setLogoPreview("");
    setErrors((current) => ({ ...current, teamLogo: "" }));
    setSubmitted(false);
  };

  const validate = () => {
    const nextErrors = {};
    const requiredFields = [
      ["fullName", "Enter your full name."],
      ["dateOfBirth", "Enter your date of birth."],
      ["teamName", "Enter your team name."],
      ["cityLocation", "Enter your city or location."],
      ["homeGroundPitch", "Enter your home ground or pitch."],
    ];

    requiredFields.forEach(([field, message]) => {
      if (!form[field].trim()) nextErrors[field] = message;
    });
    if (form.dateOfBirth && form.dateOfBirth > maxDate) {
      nextErrors.dateOfBirth = "Date of birth cannot be in the future.";
    }
    if (!form.ageGroup) nextErrors.ageGroup = "Choose an age group for this squad.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(false);
    setRequestError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      const result = await submitCoachOnboarding(form, logo, token);
      if (!result.coach || !result.squad) {
        throw new Error("The coach service did not confirm your team was saved.");
      }
      markCoachOnboardingComplete(user?.id);
      setSubmitted(true);
      navigate("/coach", {
        replace: true,
        state: { onboardingSuccess: true },
      });
    } catch (error) {
      setRequestError(error.message || "Your team could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="relative isolate overflow-hidden bg-[#061a31] text-white">
        <div className="pointer-events-none absolute -right-10 top-0 -z-10 h-full w-44 skew-x-[-35deg] border-x-[18px] border-green-800/50 bg-green-700/20" />
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-5 sm:px-8 lg:px-10">
          <div className="flex shrink-0 items-center gap-2.5 border-r border-white/40 pr-5 sm:pr-8">
            <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-white text-sm font-bold text-green-300">E</span>
            <span className="text-xl font-bold tracking-wide">ELEVN</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-green-400 sm:text-sm">Coach onboarding</p>
            <h1 className="mt-0.5 text-xl font-bold leading-tight sm:text-2xl">Set up your team</h1>
            <p className="mt-1 hidden text-sm text-slate-300 sm:block">Add the details that help players and organizers identify your team.</p>
          </div>
          <span className="shrink-0 rounded-full bg-green-500 px-3 py-1.5 text-xs font-bold text-[#061a31] sm:px-4 sm:text-sm">STEP 1 OF 1</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <form onSubmit={submit} noValidate>
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="team-details-heading">
              <SectionHeading id="team-details-heading" title="Team details" />
              <div className="mt-5 grid gap-y-3.5">
                <Field label="Full name" error={errors.fullName}>
                  <input id="fullName" name="fullName" autoComplete="name" className={inputClass} value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="e.g. John Okafor" aria-invalid={Boolean(errors.fullName)} />
                </Field>
                <Field label="Date of birth" error={errors.dateOfBirth}>
                  <input id="dateOfBirth" name="dateOfBirth" type="date" max={maxDate} autoComplete="bday" className={inputClass} value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} aria-invalid={Boolean(errors.dateOfBirth)} />
                </Field>
                <Field label="Team name" error={errors.teamName}>
                  <input id="teamName" name="teamName" className={inputClass} value={form.teamName} onChange={(event) => updateField("teamName", event.target.value)} placeholder="e.g. ELEVN Football Club" aria-invalid={Boolean(errors.teamName)} />
                </Field>
                <Field label="City / location" error={errors.cityLocation}>
                  <input id="cityLocation" name="cityLocation" autoComplete="address-level2" className={inputClass} value={form.cityLocation} onChange={(event) => updateField("cityLocation", event.target.value)} placeholder="e.g. Kingsly FCT" aria-invalid={Boolean(errors.cityLocation)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Home ground / pitch" error={errors.homeGroundPitch}>
                    <input id="homeGroundPitch" name="homeGroundPitch" className={inputClass} value={form.homeGroundPitch} onChange={(event) => updateField("homeGroundPitch", event.target.value)} placeholder="Select or enter your usual pitch" aria-invalid={Boolean(errors.homeGroundPitch)} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="teamLogo" className="block text-sm font-semibold text-slate-800">Team logo <span className="font-normal text-slate-500">(optional)</span></label>
                  <div className="mt-1.5 flex min-h-20 items-center gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Selected team logo preview" className="h-14 w-14 rounded-md border border-slate-200 bg-white object-contain p-1" />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-green-100 text-lg font-bold text-green-800" aria-hidden="true">+</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <label htmlFor="teamLogo" className="cursor-pointer text-sm font-bold text-slate-900 underline decoration-green-600 decoration-2 underline-offset-4">{logo ? "Choose a different logo" : "Upload team logo"}</label>
                      <p className="mt-1 truncate text-xs text-slate-500">{logo ? `${logo.name} · ${(logo.size / 1024).toFixed(0)} KB` : "PNG, JPG or WebP · Max size: 2 MB"}</p>
                    </div>
                    {logo && <button type="button" onClick={removeLogo} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 underline hover:text-red-700">Remove</button>}
                    <input id="teamLogo" name="teamLogo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={selectLogo} aria-describedby={errors.teamLogo ? "teamLogo-error" : undefined} />
                  </div>
                  {errors.teamLogo && <p id="teamLogo-error" className="mt-1 text-xs text-red-700" role="alert">{errors.teamLogo}</p>}
                </div>
              </div>
            </section>

            <section className="flex flex-col rounded-xl border border-slate-300 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="age-group-heading">
              <SectionHeading id="age-group-heading" title="Squad age group" />
              <fieldset className="mt-5">
                <legend className="text-lg font-bold text-slate-900">Which age group is this squad for?</legend>
                <p className="mt-1 text-sm text-slate-600">Choose one for this squad. You can add more squads later.</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {ageGroups.map((group) => (
                    <label key={group.value} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-green-600 focus-within:ring-offset-2 ${form.ageGroup === group.value ? "border-green-600 bg-green-50 text-slate-950" : "border-slate-300 bg-white text-slate-800 hover:border-green-500 hover:bg-green-50/50"}`}>
                      <input className="sr-only" type="radio" name="ageGroup" value={group.value} checked={form.ageGroup === group.value} onChange={() => updateField("ageGroup", group.value)} />
                      <span>{group.label} <span className="font-normal text-slate-600">({group.value === "OPEN_SENIOR" ? "Open" : group.value === "OTHER" ? "Other" : group.value})</span></span>
                      {form.ageGroup === group.value && <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green-700 text-xs text-white">✓</span>}
                    </label>
                  ))}
                </div>
                {errors.ageGroup && <p className="mt-2 text-sm text-red-700" role="alert">{errors.ageGroup}</p>}
              </fieldset>
              <div className="mt-5 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-blue-800 font-bold" aria-hidden="true">i</span>
                <p><strong className="block">One squad = one age group.</strong><span className="mt-1 block">Keep squads, fixtures, and statistics separate for each group.</span></p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <p className="text-xs text-slate-500">Your details and optional logo will be sent to the coach service.</p>
                <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-green-500 px-6 py-2.5 text-sm font-bold text-[#062013] transition hover:bg-green-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-wait disabled:opacity-70">
                  {submitting ? "Saving your team..." : submitted ? "Saved" : "Continue"}
                  {!submitting && <span aria-hidden="true">→</span>}
                </button>
              </div>
              {requestError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{requestError}</p>}
              {submitted && <p className="mt-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">Your coach profile and first squad were saved successfully.</p>}
            </section>
          </div>
        </form>
      </main>

      <footer className="mt-3 border-t border-slate-300 bg-[#061a31] px-5 py-4 text-xs text-slate-300 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <span>© 2026 ELEVN</span>
          <span>Coach onboarding · Step 1 of 1</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ id, title }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-700 text-sm font-bold text-white" aria-hidden="true">E</span>
      <h2 id={id} className="text-base font-bold uppercase tracking-wide text-green-800">{title}</h2>
      <span className="h-px flex-1 bg-green-700/70" aria-hidden="true" />
    </div>
  );
}

function Field({ label, error, children }) {
  const id = children.props.id;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}

export default CoachOnboarding;