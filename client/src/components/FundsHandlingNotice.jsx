export const FUNDS_HANDLING_NOTICE = 'My Ajo provides tools for organising savings groups and recording member activity. My Ajo does not receive, hold, safeguard, transfer or insure members’ money. Payments are made directly using payment details agreed by group members.';

export default function FundsHandlingNotice({ style }) {
  return (
    <div
      role="note"
      style={{
        padding: 14,
        borderRadius: 12,
        border: '1px solid rgba(200,151,58,.28)',
        background: 'rgba(200,151,58,.08)',
        color: 'var(--muted)',
        fontSize: 12,
        lineHeight: 1.6,
        ...style
      }}
    >
      {FUNDS_HANDLING_NOTICE}
    </div>
  );
}
