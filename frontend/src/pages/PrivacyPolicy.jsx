import { Link } from "react-router-dom";

function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-800 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <Link to="/account" className="text-sm font-semibold text-green-700 underline">Back to account</Link>
        <h1 className="mt-6 text-3xl font-bold">ProPitch Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: October 28, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-7">
          <p>This Privacy Policy explains how ProPitch collects, uses, and protects information when you create an account or use the platform as a player or coach.</p>
          <h2 className="text-xl font-semibold">1. Information we collect</h2>
          <p>We may collect your email address, username, selected role, authentication details, profile information, team information, player statistics, and content you submit. We may also collect basic technical information needed to keep the service secure and functional.</p>
          <h2 className="text-xl font-semibold">2. Authentication providers</h2>
          <p>ProPitch uses Clerk to provide account creation, email verification, sign-in, password recovery, and session security. If you use Google sign-in, Google may provide basic account information such as your name, email address, and profile identifier, subject to your Google settings and Google&apos;s privacy policy.</p>
          <h2 className="text-xl font-semibold">3. How we use information</h2>
          <p>We use information to create and secure accounts, verify email addresses, provide player and coach features, display profiles and team information, respond to requests, prevent abuse, and improve the platform.</p>
          <h2 className="text-xl font-semibold">4. Sharing</h2>
          <p>We may share information with service providers that help operate ProPitch, such as authentication, hosting, and database providers. We may display information to other users when a feature is designed for player or coach discovery. We do not sell personal information.</p>
          <h2 className="text-xl font-semibold">5. Public and role-based information</h2>
          <p>Your selected role and platform username may be used to distinguish coach and player profiles. Before launch, the platform owner should configure which profile fields are visible to other users and should avoid publishing sensitive information.</p>
          <h2 className="text-xl font-semibold">6. Retention and security</h2>
          <p>We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and protect the platform. We use reasonable safeguards, but no online service can guarantee absolute security.</p>
          <h2 className="text-xl font-semibold">7. Your choices</h2>
          <p>You may update account information, stop using the service, or request account deletion through the platform owner. You may also manage Google permissions through your Google account settings.</p>
          <h2 className="text-xl font-semibold">8. Children and safeguarding</h2>
          <p>ProPitch should not be used by anyone who is not permitted to use the service under the laws that apply to them. Coaches and platform administrators are responsible for appropriate safeguarding practices when working with young players.</p>
          <h2 className="text-xl font-semibold">9. Changes and contact</h2>
          <p>We may update this policy as ProPitch changes. The latest version will be posted here. For privacy questions or requests, contact the ProPitch administrator through the contact method provided by the platform owner.</p>
          <p className="border-t border-gray-200 pt-4 text-xs text-gray-500">This is a general product template and should be reviewed and customized by a qualified legal professional for your location, users, and data practices before production use.</p>
        </section>
      </article>
    </main>
  );
}

export default PrivacyPolicy;
