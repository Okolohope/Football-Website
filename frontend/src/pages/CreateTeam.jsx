import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function CreateTeam() {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const createTeam = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ name, city, country }),
      });
      if (!response.ok) throw new Error(await response.text());
      setMessage("Team created successfully.");
      setName("");
      setCity("");
      setCountry("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <button type="button" onClick={() => window.history.back()} className="mb-5 rounded-full border border-slate-300 px-4 py-2" aria-label="Go back">← Back</button>
      <h1 className="text-3xl font-bold">Create Your Team</h1>
      <p className="mt-2 text-slate-500">Set up your football team.</p>
      <form onSubmit={createTeam} className="mt-6 grid gap-4">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Team name" required minLength={2} maxLength={80} className="rounded-xl border px-4 py-3" />
        <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" maxLength={80} className="rounded-xl border px-4 py-3" />
        <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country" maxLength={60} className="rounded-xl border px-4 py-3" />
        <button type="submit" disabled={saving} className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white">{saving ? "Creating..." : "Create Team"}</button>
      </form>
      {message && <p className="mt-4 rounded-xl border p-3">{message}</p>}
    </main>
  );
}

export default CreateTeam;
