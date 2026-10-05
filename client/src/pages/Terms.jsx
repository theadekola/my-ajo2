import { Link } from 'react-router-dom';
import SvgIcon from '../components/SvgIcon.jsx';
import FundsHandlingNotice from '../components/FundsHandlingNotice.jsx';

const TERMS = [
  ['1. Acceptance of these Terms', 'By creating an account, joining a group, creating a group, submitting a payment record, sending a chat message, or using My Ajo, you agree to these Terms of Service. If you do not agree, you must not use the app.'],
  ['2. What My Ajo provides', 'My Ajo is a contribution circle management and record-keeping platform. It helps admins and members organise rotating savings groups, send reminders, record contribution evidence, schedule payouts, communicate, and keep group activity visible. My Ajo is not a bank, payment processor, e-money issuer, escrow provider, investment service, or deposit-taking institution.'],
  ['3. No custody of funds', 'Payments and payouts are made directly between group members or to the account details supplied by the group admin. My Ajo does not hold, receive, transfer, guarantee, insure, reverse, or recover any funds. Users must independently verify account details, payment evidence, and group trustworthiness before sending money.'],
  ['4. Eligibility and account information', 'You must provide accurate registration and profile information and keep it updated. You are responsible for protecting your login details and for all activity carried out through your account. You must not impersonate another person or create an account using false information.'],
  ['5. Group admin responsibilities', 'Admins are responsible for creating accurate group rules, approving trustworthy members, providing correct payment information, reviewing evidence fairly, confirming genuine payments, scheduling payouts, and keeping members informed. Admins must use the platform in line with applicable data protection, consumer protection, anti-fraud, anti-money laundering, and cybercrime laws.'],
  ['6. Member responsibilities', 'Members are responsible for reviewing group information before joining, paying only through verified details, uploading true and clear payment evidence, communicating respectfully, and complying with group rules and applicable law. False receipts, misleading references, or fraudulent activity may lead to removal, suspension, or legal reporting.'],
  ['7. Payment records and evidence', 'Payment submissions, receipts, screenshots, references, contribution history, payout records, and admin decisions are stored to support accountability, audit, dispute review, and lawful record keeping. A payment record inside My Ajo is not proof that money has settled unless the admin or receiving party independently confirms it.'],
  ['8. Privacy and member visibility', 'My Ajo includes privacy controls that may allow admins to hide member names from other non-admin members. Admins may still see members for group management, compliance, safety, and payout purposes. Privacy settings do not remove the need for accurate records or lawful processing of personal data.'],
  ['9. Chat and notifications', 'Users must use group chat and private chat respectfully and lawfully. Account, payment, payout, deletion, and group notifications are provided to help users manage group activity, but users should still check the app directly for important updates.'],
  ['10. Account deletion and recovery', 'Account deletion may make the account inactive for a 24-hour recovery period before final deletion. Members in groups may need admin approval before deletion proceeds. Admins who created groups may need to remove or resolve active members before their account can be deleted.'],
  ['11. Prohibited activities', 'You must not use My Ajo for fraud, money laundering, terrorist financing, illegal lending, unlawful investment schemes, harassment, impersonation, false payment evidence, unauthorised access, malware, scraping, or any activity that breaches applicable laws or another person rights.'],
  ['12. Data protection and privacy laws', 'Personal data is handled according to the Privacy Policy and relevant data protection principles. Depending on the user, location, and operation of the service, relevant laws may include the Nigeria Data Protection Act 2023, the UK GDPR and Data Protection Act 2018, the EU General Data Protection Regulation, and similar privacy laws in other jurisdictions.'],
  ['13. Account restriction or removal', 'We may restrict, suspend, or remove accounts or group access where we reasonably believe there is fraud, abuse, security risk, legal risk, breach of these Terms, or harm to other users. Admins may also remove members from their groups where the app permits it and the group rules allow it.'],
  ['14. Disputes between users', 'My Ajo may provide records that help users understand what happened in a group, but disputes about payments, payouts, trust, refunds, or group rules are between the relevant users. We are not responsible for resolving private financial disputes between group members.'],
  ['15. Service availability', 'We aim to keep the app available and secure, but we do not guarantee uninterrupted access. Maintenance, network issues, hosting issues, third-party services, security incidents, or force majeure events may affect availability.'],
  ['16. Limitation of liability', 'To the fullest extent permitted by law, My Ajo and its operators are not liable for indirect loss, lost profit, loss of funds sent to wrong or fraudulent accounts, member disputes, inaccurate user-supplied information, or events outside reasonable control. Nothing in these Terms excludes liability that cannot legally be excluded.'],
  ['17. Changes to these Terms', 'We may update these Terms to reflect app changes, legal requirements, or operational needs. Continued use of My Ajo after an update means you accept the updated Terms.'],
  ['18. Legal review', 'These Terms are written for transparency and should be reviewed by a qualified lawyer before commercial or regulated use. If any part is unenforceable, the remaining sections remain in effect.'],
  ['19. Contact', 'For questions about these Terms, contact support@my-ajo.org.']
];

function PageBackTitle({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Link to="/help" aria-label="Back to Support" title="Back" style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--deep)', textDecoration: 'none', flexShrink: 0 }}>
        <SvgIcon name="arrowLeft" size={20} />
      </Link>
      <div className="ptitle">{title}</div>
    </div>
  );
}

export default function Terms() {
  return (
    <div className="page-enter">
      <div className="topbar"><div><PageBackTitle title="Terms of Service" /><div className="psub" style={{ marginLeft: 38 }}>Last updated: May 2026</div></div></div>
      <div className="card" style={{ marginBottom: 18 }}><div className="card-hd"><div className="card-ttl">Service terms notice</div></div><div style={{ padding: 20 }}><div style={{ background: 'rgba(200,151,58,.08)', border: '1px solid rgba(200,151,58,.25)', borderRadius: 14, padding: 16, color: 'var(--muted)', lineHeight: 1.7 }}>These Terms explain the rules for using My Ajo. They support good governance, privacy, and accountability, but they are not a substitute for advice from a qualified legal professional.</div></div></div>
      <FundsHandlingNotice style={{ marginBottom: 18, fontSize: 14 }} />
      <div className="card">{TERMS.map(([title, body]) => (<section key={title} style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,.05)' }}><div className="card-ttl" style={{ marginBottom: 8 }}>{title}</div><div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>{body}</div></section>))}</div>
    </div>
  );
}
