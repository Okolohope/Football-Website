import AccountHeader from "../components/AccountHeader";

function PlayerDashboard() {
  return (
    <div className="min-h-screen">
      <AccountHeader />
      <main className="p-8">
        <h1 className="text-3xl font-bold">Player Dashboard</h1>
        <p className="mt-2 text-gray-600">Track your football stats and opportunities.</p>
      </main>
    </div>
  );
}

export default PlayerDashboard;
