import { Link } from "react-router-dom";

function TermsOfService() {
  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-800 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <Link to="/account" className="text-sm font-semibold text-green-700 underline">Back to account</Link>
        <h1 className="mt-6 text-3xl font-bold">ProPitch Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: October 28, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-7">
          <p>These Terms of Service govern your use of ProPitch, a platform that helps football players and coaches connect, manage profiles, and organize team information. By creating an account or using ProPitch, you agree to these terms.</p>
          <h2 className="text-xl font-semibold">1. Accounts</h2>
          <p>You must provide accurate information, keep your login details secure, and use only one account for each role you operate. You are responsible for activity performed through your account. Email verification may be required before you can use account features.</p>
          <h2 className="text-xl font-semibold">2. Player and coach roles</h2>
          <p>You must select the role that accurately describes how you use ProPitch. Coach features and player features may be different. You may not impersonate another person, team, coach, or player.</p>
          <h2 className="text-xl font-semibold">3. Acceptable use</h2>
          <p>You may not use ProPitch to harass, threaten, deceive, spam, or distribute unlawful, harmful, or abusive content. Do not attempt to access another user account, interfere with the platform, or use information from ProPitch for unauthorized commercial purposes.</p>
          <h2 className="text-xl font-semibold">4. User content</h2>
          <p>You retain responsibility for information and content you submit. You grant ProPitch permission to store and display that content as needed to provide the service. Do not submit content that violates another person&apos;s rights or applicable law.</p>
          <h2 className="text-xl font-semibold">5. Third-party services</h2>
          <p>ProPitch uses third-party services for authentication and related functionality, including Clerk and Google sign-in. Their services may have separate terms and privacy policies.</p>
          <h2 className="text-xl font-semibold">6. Availability and changes</h2>
          <p>We may update, suspend, or discontinue parts of ProPitch as the platform develops. We may update these terms when necessary and will post the revised version on this page.</p>
          <h2 className="text-xl font-semibold">7. Account closure</h2>
          <p>You may stop using ProPitch at any time. We may suspend or close accounts that violate these terms or create risk for users or the platform.</p>
          <h2 className="text-xl font-semibold">8. Disclaimer</h2>
          <p>ProPitch is provided on an as-available basis. We do not guarantee that users will be selected for a team, receive an opportunity, or achieve a particular sporting result. ProPitch is not a substitute for professional legal, medical, or safeguarding advice.</p>
          <h2 className="text-xl font-semibold">9. Contact</h2>
          <p>For questions about these terms, contact the ProPitch administrator through the contact method provided by the platform owner.</p>
          <p className="border-t border-gray-200 pt-4 text-xs text-gray-500">This is a general product template and should be reviewed and customized by a qualified legal professional before production use.</p>
        </section>
      </article>
    </main>
  );
}

export default TermsOfService;
