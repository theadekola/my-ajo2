import { useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
  {
    icon: 'rocket',
    title: 'Getting started',
    steps: [
      'Sign in with your email and password.',
      'Open More, then Profile, and check your name, phone number, country, and account details.',
      'Use the bottom navigation to move between Home, Groups, Contributions, Calendar, and More.',
      'Tap the bell icon to view payment, member, payout, and chat notifications.'
    ]
  },
  {
    icon: 'home',
    title: 'Home page',
    steps: [
      'Home shows your total contributed amount, total received amount, active groups, and unread alerts.',
      'Use My Groups to open a group quickly.',
      'Use Recent Activity to review recent confirmed and pending contributions.',
      'Use Next Payout to see the next scheduled recipient where available.'
    ]
  },
  {
    icon: 'link',
    title: 'Join a group',
    steps: [
      'Ask the group admin for an invite code or invite link.',
      'Open Groups and choose Join Group.',
      'Enter the invite code and preview the group details.',
      'Confirm the join request if the group details and country restriction are correct.',
      'Wait for the admin to approve your membership.'
    ]
  },
  {
    icon: 'users',
    title: 'Admin: create and manage a group',
    steps: [
      'Admin accounts can create new groups from the Groups page.',
      'Enter the group name, contribution amount, frequency, maximum members, and start date.',
      'Open the group page to manage Members, Make Payment, Payment Info, Payments, Contributions, My Bank Details, Disbursement, Group Chat, and Statistics.',
      'Use Members to approve or reject join requests.',
      'Use the member arrow menu to view profile, show contribution history, export a statement as PDF, or remove a member when allowed.',
      'Use Invite to generate and share invite codes.'
    ]
  },
  {
    icon: 'card',
    title: 'Make a contribution',
    steps: [
      'Open a group and tap Make Payment.',
      'Check the payment details at the top of the page.',
      'Enter the contribution amount in currency format.',
      'Select Bank Transfer.',
      'Upload your receipt or screenshot. Bank transfer payments cannot be submitted without evidence.',
      'Submit the payment and wait for the admin to confirm it.'
    ]
  },
  {
    icon: 'bank',
    title: 'Admin: review payments and payouts',
    steps: [
      'Open Payments to review member payment submissions.',
      'Open each payment to confirm or reject it.',
      'Open Disbursement to schedule or manage payouts.',
      'Check the recipient bank details before making any transfer.',
      'Mark payouts as paid only after the money has been sent.'
    ]
  },
  {
    icon: 'message',
    title: 'Group chat and private chat',
    steps: [
      'Open Group Chat from a group page.',
      'Use the Group chat tab for messages everyone in the group can see.',
      'Use the Private chat tab to choose a member and message them privately.',
      'When group member privacy is enabled by an admin, non-admin members may see other members as anonymous.'
    ]
  },
  {
    icon: 'settings',
    title: 'Settings and privacy',
    steps: [
      'Open More, then Settings.',
      'Turn payment, payout, member, and chat notifications on or off.',
      'Enable mobile push notifications only when using the secure Cloudflare domain.',
      'A group admin can turn on Group members anonymous from that group page. The setting applies only to the selected group; members see only their own identity while the group admin can still see everyone.'
    ]
  },
  {
    icon: 'phone',
    title: 'Install the app on your phone',
    steps: [
      'Open More, then Install App.',
      'On iPhone, open www.my-ajo.org in Safari, tap Share, then Add to Home Screen.',
      'On Android, open www.my-ajo.org in Chrome, tap the menu, then Install App or Add to Home Screen.',
      'After installing, open My Ajo from your phone home screen.'
    ]
  },
  {
    icon: 'shield',
    title: 'Account and security tips',
    steps: [
      'Keep your password private.',
      'Verify group and payment details before sending money.',
      'Do not upload false payment evidence.',
      'Use Sign Out from More when using a shared device.',
      'Contact support from the Support page if you notice suspicious activity.'
    ]
  }
];

export default function UserGuide() {
  const [open, setOpen] = useState(0);
  const navigate = useNavigate();
  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <button type="button" className="back-link" onClick={() => navigate('/more')} aria-label="Back to More" title="Back to More">
            <SvgIcon name="arrowLeft" size={20} />
          </button>
          <div className="ptitle">User Guide</div>
          <div className="psub">Step-by-step help for using My Ajo</div>
        </div>
      </div>

      <div className="card">
        {SECTIONS.map((section, index) => (
          <div key={section.title} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
            <button
              type="button"
              onClick={() => setOpen(open === index ? -1 : index)}
              style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: 0, background: 'transparent', textAlign: 'left' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(200,151,58,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--deep)', flexShrink: 0 }}>
                <SvgIcon name={section.icon} size={18} />
              </div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--deep)' }}>{section.title}</div>
              <SvgIcon name="chevronDown" size={18} style={{color:'var(--gold)',transform:open===index?'rotate(180deg)':'none',transition:'transform .18s'}}/>
            </button>
            {open === index && (
              <div style={{ padding: '0 20px 18px 64px' }}>
                {section.steps.map((step, stepIndex) => (
                  <div key={step} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--deep)', color: 'var(--gold)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      {stepIndex + 1}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{step}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

