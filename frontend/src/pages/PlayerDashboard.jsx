import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import AccountHeader from "../components/AccountHeader";
import PlayerProfileSetup from "../components/PlayerProfileSetup";

function PlayerDashboard() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <p className="p-6 text-white">Loading your profile...</p>;
  return <PlayerDashboardContent key={user.id} userId={user.id} />;
}

function PlayerDashboardContent({ userId }) {
  const profileKey = `propitch_player_profile_${userId}`;
  const [profile, setProfile] = useState(() => loadProfile(profileKey));

  if (!profile) {
    return <PlayerProfileSetup onComplete={(savedProfile) => {
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      setProfile(savedProfile);
    }} />;
  }

  return <Dashboard profile={profile} />;
}

function Dashboard({ profile }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AccountHeader />
      <main className="mx-auto max-w-7xl p-4 sm:p-8">
        <section className="rounded-2xl border border-slate-700 bg-gradient-to-r from-[#0d3047] to-[#123f4a] p-6 sm:p-10">
          <p className="text-sm text-emerald-300">Welcome back,</p>
          <div className="flex items-center gap-4">
            {profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full border-2 border-emerald-300 object-cover" />}
            <h1 className="mt-1 text-3xl font-bold sm:text-5xl">{profile.fullName}</h1>
          </div>
          <p className="mt-3 max-w-lg text-slate-300">Keep pushing. Your next opportunity is closer than you think.</p>
        </section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-700 bg-[#0b2439] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-400">Player profile</p><h2 className="mt-1 text-2xl font-bold">{profile.nickname || profile.fullName}</h2><p className="mt-1 text-sm text-emerald-300">{profile.primaryPosition} · {profile.preferredFoot} foot</p></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">Profile ready</span></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-slate-950/40 p-4"><p className="text-xs text-slate-500">Location</p><p className="mt-1 text-sm">{profile.city}, {profile.country}</p></div><div className="rounded-xl bg-slate-950/40 p-4"><p className="text-xs text-slate-500">Level</p><p className="mt-1 text-sm">{profile.playingLevel}</p></div><div className="rounded-xl bg-slate-950/40 p-4"><p className="text-xs text-slate-500">Experience</p><p className="mt-1 text-sm">{profile.yearsPlaying} years</p></div></div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-[#0b2439] p-6"><h2 className="text-lg font-bold">Upcoming opportunities</h2><p className="mt-2 text-sm text-slate-400">New trials and academy opportunities will appear here.</p><div className="mt-6 rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">No opportunities yet</div></div>
        </section>
      </main>
    </div>
  );
}

function loadProfile(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export default PlayerDashboard;
