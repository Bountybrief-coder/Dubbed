import React from "react";
import { Shield } from "lucide-react";

export function PrivacyPage() {
  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow"><Shield size={14} style={{ marginRight: 6, verticalAlign: -2 }} />PRIVACY POLICY</div>
        <h1>Privacy Policy</h1>
        <p className="sub">Effective July 2026 &mdash; Dubbed (dubbed.pro)</p>
      </div>

      <section className="panel2 rulesSection">
        <h2>1. Information We Collect</h2>
        <p>When you create an account and use Dubbed, we collect the following types of information:</p>
        <ul>
          <li><b>Account information:</b> email address, username, and avatar image.</li>
          <li><b>Payment information:</b> processed securely by Stripe. We never store your credit card numbers, CVVs, or full card details on our servers.</li>
          <li><b>Game identifiers:</b> PlayStation Network (PSN) ID, Xbox Gamertag, and Activision ID, as provided by you for matchmaking purposes.</li>
          <li><b>Match data:</b> match history, results, win/loss records, and performance statistics generated through your use of the platform.</li>
          <li><b>Social media handles:</b> any social profiles you choose to link to your Dubbed account (e.g., X/Twitter, Discord).</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect for the following purposes:</p>
        <ul>
          <li><b>Account creation and management:</b> to set up your profile, authenticate your identity, and maintain your account.</li>
          <li><b>Matchmaking and wager facilitation:</b> to pair you with opponents, process wagers, and record match outcomes.</li>
          <li><b>Payment processing:</b> to handle deposits, withdrawals, and wager payouts through our payment provider.</li>
          <li><b>XP and ranking calculations:</b> to track your competitive progress, assign ranks, and display leaderboard standings.</li>
          <li><b>Anti-cheat and fair play enforcement:</b> to detect, investigate, and act on cheating, exploits, smurfing, and other rule violations.</li>
          <li><b>Platform improvement:</b> to analyze usage patterns, fix bugs, and improve the overall Dubbed experience.</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>3. Third-Party Services</h2>
        <p>Dubbed relies on a limited number of trusted third-party services to operate the platform:</p>
        <ul>
          <li><b>Stripe</b> handles all payment processing. When you add a payment method or receive a payout, your financial data is transmitted directly to Stripe and governed by their privacy policy at <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>.</li>
          <li><b>Supabase</b> provides our database hosting and user authentication infrastructure. Your account data is stored securely within Supabase's managed environment.</li>
          <li><b>Google Analytics (GA4)</b> is used via Google Tag Manager to collect anonymous, aggregated usage data such as page views, button clicks, and feature engagement. This helps us understand how the platform is used and improve it. No personally identifiable information is sent to Google. You can opt out by using a browser extension such as the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out Browser Add-on</a>.</li>
        </ul>
        <p>We do not use advertising networks or data brokers. Your data is not monetized through ads.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>4. Cookies and Local Storage</h2>
        <p>Dubbed uses a minimal set of cookies and local storage entries strictly necessary to operate the platform:</p>
        <ul>
          <li><b>Session authentication tokens:</b> used to keep you logged in and verify your identity across page loads.</li>
          <li><b>Essential site functionality cookies:</b> used to remember preferences and maintain session state.</li>
        </ul>
        <p>We do not use advertising or retargeting cookies. Google Analytics may set a cookie to distinguish unique visitors; this cookie contains no personal information and is not used for advertising. Your browsing activity on our site is never sold or shared for marketing purposes.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>5. Data Sharing</h2>
        <p><b>We do not sell your personal data.</b> Under no circumstances is your information sold to third parties for marketing, advertising, or any other commercial purpose.</p>
        <p>Your information may be shared only in the following limited situations:</p>
        <ul>
          <li><b>With Stripe:</b> payment-related data necessary to process transactions, deposits, and withdrawals.</li>
          <li><b>With Google:</b> anonymous usage events (page views, feature clicks) via Google Analytics. No personal information, payment data, or match results are shared.</li>
          <li><b>With other players:</b> only your public profile information is visible to other users. This includes your username, avatar, linked game IDs, and match statistics. Your email address, payment details, and private account data are never exposed to other players.</li>
          <li><b>With law enforcement:</b> if we are legally compelled by a valid court order, subpoena, or other binding legal process, we may disclose information as required by law.</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>6. Data Security</h2>
        <p>We take the security of your data seriously and implement industry-standard measures to protect it:</p>
        <ul>
          <li><b>SSL/TLS encryption:</b> all data transmitted between your browser and our servers is encrypted in transit.</li>
          <li><b>Secure authentication:</b> user authentication is handled through Supabase Auth, which provides secure session management, password hashing, and token-based verification.</li>
          <li><b>Regular security audits:</b> we conduct periodic reviews of our infrastructure and codebase to identify and address potential vulnerabilities.</li>
        </ul>
        <p>While no system is perfectly secure, we are committed to protecting your information and will notify affected users promptly in the unlikely event of a data breach.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>7. Your Rights</h2>
        <p>You have the following rights regarding your personal data on Dubbed:</p>
        <ul>
          <li><b>Request account deletion:</b> you may request that your account and all associated data be permanently deleted. Contact us and we will process your request within 30 days.</li>
          <li><b>Export your data:</b> you may request a copy of the personal data we hold about you in a portable format.</li>
          <li><b>Update your information:</b> you can update your email address, profile details, and linked game IDs at any time through your account settings.</li>
          <li><b>Opt out of communications:</b> you may unsubscribe from non-essential emails and notifications at any time. Transactional emails related to your account, matches, and payouts may still be sent as necessary.</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>8. Age Restriction</h2>
        <p>Dubbed is an 18+ platform designed for cash wager matches. You must be at least 18 years of age to create an account and participate in any wagered matches on the platform.</p>
        <p>In compliance with the Children's Online Privacy Protection Act (COPPA) and similar regulations, we do not knowingly collect personal information from individuals under the age of 18. If we become aware that a user is under 18, their account will be terminated and all associated data will be deleted.</p>
        <p>All users are required to verify that they are 18 or older before participating in cash matches. Dubbed reserves the right to request additional age verification at any time.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>9. Changes to This Policy</h2>
        <p>We may update this privacy policy from time to time to reflect changes in our practices, services, or legal requirements. When we make material changes, we will notify registered users via email and update the effective date at the top of this page.</p>
        <p>Continued use of Dubbed after a policy update constitutes acceptance of the revised terms. We encourage you to review this page periodically.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>10. Contact</h2>
        <p>For privacy-related inquiries, data requests, or concerns about how your information is handled, reach out to us on X (Twitter) at <a href="https://x.com/dubbedgg" target="_blank" rel="noopener noreferrer">@dubbedgg</a>.</p>
      </section>
    </main>
  );
}
