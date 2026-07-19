import React from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { FileText } from "lucide-react";

export function TermsPage() {
  usePageMeta("Terms of Service", "Terms and conditions for using Dubbed, including wagering rules, age requirements, and user conduct.");
  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow"><FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />TERMS OF SERVICE</div>
        <h1>Terms of Service</h1>
        <p className="sub">Effective July 2026 · Dubbed (dubbed.pro)</p>
      </div>

      <section className="panel2 rulesSection">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using the Dubbed platform at dubbed.pro (the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Platform.</p>
        <p>You must be at least 18 years of age to use Dubbed. By creating an account, you confirm that you are 18 or older and that you have the legal capacity to enter into this agreement.</p>
        <p>These Terms constitute a binding agreement between you and Dubbed. Your continued use of the Platform following any changes to these Terms constitutes your acceptance of those changes.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>2. Eligibility</h2>
        <p>To use Dubbed and participate in cash matches, you must meet all of the following requirements:</p>
        <ul>
          <li><b>Age:</b> you must be at least 18 years old.</li>
          <li><b>Location:</b> you must not be located in a jurisdiction where skill-based wagering is prohibited or restricted by law.</li>
          <li><b>Accurate representation:</b> you must accurately represent your location and identity. Misrepresenting your location to circumvent geographic restrictions is a violation of these Terms and grounds for immediate account termination.</li>
        </ul>
        <p><b>Cash wagering is NOT available in the following US states:</b> Arizona, Arkansas, Connecticut, Delaware, Louisiana, Maryland, Montana, South Carolina, South Dakota, and Tennessee.</p>
        <p><b>Cash wagering is NOT available in the following Canadian province:</b> Quebec.</p>
        <p>If you reside in or are physically located in any of the jurisdictions listed above, you may not participate in cash matches on the Platform. Free-to-play features may still be available where permitted. It is your responsibility to know and comply with the laws of your jurisdiction.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>3. Account</h2>
        <p>To participate in matches on Dubbed, you must create an account. You agree to the following account terms:</p>
        <ul>
          <li><b>One account per person:</b> each individual may maintain only one account on the Platform. Creating multiple accounts to gain an unfair advantage, evade bans, or manipulate match outcomes is strictly prohibited and will result in permanent suspension of all associated accounts.</li>
          <li><b>Account security:</b> you are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Dubbed is not liable for any loss or damage arising from unauthorized access to your account.</li>
          <li><b>Accurate information:</b> if you participate in cash matches, you must provide accurate personal information including a valid email address and, where applicable, identity verification. Accounts with false or misleading information may be suspended or terminated.</li>
          <li><b>Game IDs:</b> you must link valid game identifiers (PSN ID, Xbox Gamertag, or Activision ID) to participate in matches. You are responsible for ensuring these are accurate and belong to you.</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>4. Cash Matches & Wagering</h2>
        <p>Dubbed operates as a skill-based competitive platform. Matches on Dubbed are contests of skill, not games of chance. The outcome of every match is determined by the relative performance of the players involved.</p>
        <ul>
          <li><b>Entry fees:</b> when you enter a cash match, your entry fee is collected and held in escrow until the match is completed and a result is confirmed.</li>
          <li><b>Platform fee (rake):</b> Dubbed charges a 5% platform fee on standard cash matches. WAGR members receive a 0% rake on all cash matches as a membership benefit.</li>
          <li><b>Match results:</b> results are determined based on the agreed-upon match format and rules. Both players are expected to report results honestly. In the event of a dispute, results will be reviewed and resolved by Dubbed administrators.</li>
          <li><b>Dispute resolution:</b> if a match result is contested, either player may submit a dispute. Dubbed administrators will review available evidence, including screenshots, video, and match data, and issue a final ruling. Admin decisions on match disputes are final and binding.</li>
          <li><b>Escrow:</b> all entry fees for cash matches are held in escrow during the match. Funds are released to the winner after the result is confirmed. In the case of a dispute, funds remain in escrow until the dispute is resolved.</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>5. Deposits & Withdrawals</h2>
        <p>All financial transactions on Dubbed are processed using cryptocurrency through our payment provider, NOWPayments.</p>
        <ul>
          <li><b>Deposits:</b> the minimum deposit amount is $5.00 USD (equivalent in supported cryptocurrency). Deposits are credited to your account balance once the blockchain transaction reaches the required number of confirmations.</li>
          <li><b>Withdrawals:</b> the minimum withdrawal amount is $5.00 USD (equivalent in supported cryptocurrency). Withdrawal requests are processed as quickly as possible, but processing times may vary depending on network congestion and blockchain confirmation times.</li>
          <li><b>Blockchain responsibility:</b> Dubbed is not responsible for delays, failed transactions, or losses caused by blockchain network congestion, incorrect wallet addresses, or other factors outside our control. Once a withdrawal is broadcast to the blockchain, it cannot be reversed.</li>
          <li><b>Transaction fees:</b> blockchain network fees (gas fees) are separate from any platform fees and are the responsibility of the user. These fees are determined by the blockchain network, not by Dubbed.</li>
        </ul>
        <p>By making a deposit, you confirm that the funds being deposited are lawfully yours and are not derived from any illegal activity.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>6. Fair Play</h2>
        <p>Dubbed is committed to providing a fair and competitive environment for all players. The following rules apply to all matches on the Platform:</p>
        <ul>
          <li><b>CDL rulesets:</b> all competitive matches on Dubbed follow Call of Duty League (CDL) rulesets and restrictions unless otherwise specified in the match lobby settings.</li>
          <li><b>Cheating:</b> the use of aimbots, wallhacks, modded controllers, cronus devices, or any other unauthorized software or hardware that provides an unfair advantage is strictly prohibited. Players found cheating will receive a permanent ban and forfeit all funds in their account.</li>
          <li><b>Match manipulation:</b> intentionally losing matches, colluding with opponents, win trading, or any other form of match manipulation is prohibited and will result in account suspension or permanent ban.</li>
          <li><b>Smurfing:</b> creating alternate accounts or intentionally lowering your skill rating to gain easier matchups is prohibited.</li>
          <li><b>Reporting violations:</b> players are encouraged to report suspected fair play violations. All reports are reviewed by Dubbed administrators, and appropriate action will be taken.</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>7. WAGR Membership</h2>
        <p>Dubbed offers an optional premium subscription called WAGR Membership with the following terms:</p>
        <ul>
          <li><b>Pricing:</b> WAGR Membership costs $7.99 per month.</li>
          <li><b>Benefits:</b> WAGR members enjoy a 0% rake on all cash matches (compared to the standard 5% platform fee), along with any other benefits introduced over time.</li>
          <li><b>Auto-renewal:</b> WAGR Membership automatically renews each month unless cancelled. You will be charged the monthly fee at the beginning of each billing cycle.</li>
          <li><b>Cancellation:</b> you may cancel your WAGR Membership at any time through your account settings. Upon cancellation, your membership benefits will remain active until the end of your current billing period. No partial refunds are issued for unused portions of a billing cycle.</li>
        </ul>
      </section>

      <section className="panel2 rulesSection">
        <h2>8. Intellectual Property</h2>
        <p>The Dubbed platform, including its name, logo, website design, software, graphics, and all associated content, is the intellectual property of Dubbed and is protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works based on any part of the Platform without prior written consent.</p>
        <p>Call of Duty, Warzone, and all related trademarks, logos, and game assets are the property of Activision Publishing, Inc. Dubbed is not affiliated with, endorsed by, or sponsored by Activision. All game-related trademarks are used solely for identification and descriptive purposes.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>9. Limitation of Liability</h2>
        <p>The Platform is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
        <p>To the maximum extent permitted by applicable law, Dubbed shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:</p>
        <ul>
          <li>Loss of funds resulting from gameplay outcomes.</li>
          <li>Losses caused by unauthorized access to your account due to your failure to secure your credentials.</li>
          <li>Service interruptions, server downtime, or technical issues affecting match availability or performance.</li>
          <li>Losses arising from blockchain transaction failures, delays, or incorrect wallet addresses.</li>
          <li>Any action taken by Dubbed to enforce these Terms, including account suspension or termination.</li>
        </ul>
        <p>You acknowledge that you use the Platform and participate in cash matches at your own risk.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>10. Termination</h2>
        <p>Dubbed reserves the right to suspend or permanently terminate any account at our sole discretion, with or without prior notice, for any reason including but not limited to:</p>
        <ul>
          <li>Violation of these Terms of Service.</li>
          <li>Cheating, match manipulation, or other fair play violations.</li>
          <li>Fraudulent activity or use of the Platform for illegal purposes.</li>
          <li>Operating multiple accounts.</li>
          <li>Providing false information or misrepresenting your identity or location.</li>
        </ul>
        <p>Upon account termination, any remaining account balance will be returned to the user, minus any funds subject to pending disputes, active investigations, or forfeiture due to fair play violations. Dubbed is not obligated to return funds that have been forfeited as a result of Terms violations.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>11. Governing Law</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Dubbed operates, without regard to conflict of law principles. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in that jurisdiction.</p>
        <p>If any provision of these Terms is found to be invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>12. Changes to Terms</h2>
        <p>Dubbed reserves the right to modify or update these Terms of Service at any time. When material changes are made, we will notify registered users via email and update the effective date at the top of this page.</p>
        <p>Your continued use of the Platform after any changes to these Terms constitutes your acceptance of the revised Terms. If you do not agree with the updated Terms, you must stop using the Platform and may request account deletion.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>13. Contact</h2>
        <p>If you have any questions, concerns, or inquiries regarding these Terms of Service, please contact us at <a href="mailto:support@dubbed.pro">support@dubbed.pro</a>.</p>
      </section>
    </main>
  );
}
