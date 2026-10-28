import { useClerk, useUser } from "@clerk/clerk-react";

function AccountHeader() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const displayName = user?.unsafeMetadata?.appUsername || user?.firstName || user?.primaryEmailAddress?.emailAddress || "there";

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sm:px-8">
      <p className="text-lg font-semibold text-gray-800">Welcome, {displayName}!</p>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem("propitch_logout_pending", "true");
          signOut({ redirectUrl: "/account" });
        }}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-red-500 hover:text-red-600"
      >
        Log Out
      </button>
    </header>
  );
}

export default AccountHeader;
