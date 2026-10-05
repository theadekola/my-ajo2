import { Link } from 'react-router-dom';
import SvgIcon from '../components/SvgIcon.jsx';

const POLICY = [
  ['1. Who we are', 'My Ajo provides software for managing rotating savings groups. The operator of the My Ajo service is responsible for deciding how personal data is collected, used, stored, and protected. For privacy requests, contact support@my-ajo.org.'],
  ['2. Legal framework', 'Where applicable, this policy is intended to align with recognised data protection principles under laws such as the Nigeria Data Protection Act 2023, the UK GDPR and Data Protection Act 2018, the EU General Data Protection Regulation, and similar privacy laws in other jurisdictions. These laws generally require lawful, fair, transparent, limited, secure, and accountable processing of personal data.'],
  ['3. Personal data we collect', 'We may collect your name, email address, phone number, country, profile photo, title, sex, occupation, address, account role, login status, notification preferences, and app settings. We also collect group membership information, slot number, contribution records, payout records, payment references, uploaded receipts or screenshots, invite code activity, chat messages, account deletion requests, and account activity.'],
  ['4. Bank and payout information', 'Bank name, account number, account name, routing or sort code, and payout information may be collected when you provide them. These details are used to help group admins arrange payouts, verify contribution instructions, or confirm payments. They should only be shared where necessary for group administration and payout processing.'],
  ['5. How we use your data', 'We use personal data to create and secure accounts, verify email addresses, operate groups, manage contributions and payouts, send notifications, support chat, apply group privacy settings, generate calendars and statements, provide support, prevent abuse, investigate suspicious activity, maintain audit records, and comply with legal or regulatory obligations.'],
  ['6. Lawful bases for processing', 'Depending on the context, we process data because it is needed to provide the service you requested, because you gave consent, because we have a legitimate interest in operating and securing the app, because processing is necessary for legal obligations, or because it is needed to protect users from fraud or abuse.'],
  ['7. Data sharing inside groups', 'Your name, avatar, country, slot number, contribution status, and relevant group activity may be visible to admins and members of groups you join. When an admin enables group member anonymity, non-admin members may see other members as anonymous, while admins may still see member details for management, safety, payout, and audit purposes.'],
  ['8. Third parties and service providers', 'We do not sell your personal data. We may share data with hosting providers, email or notification services, storage services, technical support providers, security providers, legal advisers, or authorities where required by law. Each provider should only receive data needed for its role.'],
  ['9. Cookies and local storage', 'My Ajo may use secure authentication cookies, local storage, service workers, and browser storage to keep you signed in, support PWA installation, enable offline behaviour, and manage push notification subscriptions. Passwords and encryption keys should never be stored in cookies.'],
  ['10. Mobile push notifications', 'If you enable push notifications, your browser or phone creates a push subscription linked to your device. This is used to send payment, payout, member, account, and chat alerts according to your settings. You can turn push notifications off in Settings or in your device/browser settings.'],
  ['11. Retention', 'We keep personal data only for as long as reasonably needed for account operation, group administration, audit, dispute review, security, legal compliance, or backup purposes. Some financial, contribution, payout, and audit records may be retained after account deletion where retention is necessary for legitimate records or legal reasons.'],
  ['12. Your rights', 'Depending on the law that applies to you, you may have rights to access, correct, delete, restrict, object to processing, withdraw consent, request portability, or complain to a data protection authority. You can update many details in Profile and can contact support@my-ajo.org for other requests.'],
  ['13. Account deletion', 'Account deletion may include a 24-hour inactive recovery period. If you are a member of an active group, deletion may require admin approval first. If you are an admin with active members in a group you created, you may need to resolve or remove those members before deletion can continue. Some historical records may remain where needed for audit, dispute, security, or legal purposes.'],
  ['14. Security', 'We use security measures such as password hashing, authenticated API access, role-based controls, upload handling, server-side checks, and encryption for sensitive fields where configured. No system is completely risk-free, so users should protect their passwords and report suspicious activity quickly.'],
  ['15. International transfers', 'If the service, hosting, support, or users operate across countries, personal data may be accessed or stored outside your country. Where required, appropriate safeguards should be used to protect transferred data.'],
  ['16. Children', 'My Ajo is not intended for children or for users who cannot lawfully enter group payment arrangements. If you believe a child has provided personal data, contact support@my-ajo.org.'],
  ['17. Changes to this policy', 'We may update this Privacy Policy when the app, legal requirements, or processing practices change. The latest version will be shown in the app.'],
  ['18. Contact', 'For privacy questions, data requests, or complaints, contact support@my-ajo.org.']
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

export default function Privacy() {
  return (
    <div className="page-enter">
      <div className="topbar"><div><PageBackTitle title="Privacy Policy" /><div className="psub" style={{ marginLeft: 38 }}>Last updated: May 2026</div></div></div>
      <div className="card" style={{ marginBottom: 18 }}><div className="card-hd"><div className="card-ttl">Data protection notice</div></div><div style={{ padding: 20 }}><div style={{ background: 'rgba(200,151,58,.08)', border: '1px solid rgba(200,151,58,.25)', borderRadius: 14, padding: 16, color: 'var(--muted)', lineHeight: 1.7 }}>This policy explains how My Ajo handles personal data. It supports transparency and data protection compliance, but the operator should obtain legal review before public or regulated use.</div></div></div>
      <div className="card">{POLICY.map(([title, body]) => (<section key={title} style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,.05)' }}><div className="card-ttl" style={{ marginBottom: 8 }}>{title}</div><div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>{body}</div></section>))}</div>
    </div>
  );
}
