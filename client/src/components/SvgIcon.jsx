const ICONS = {
  search: ['M21 21l-4.35-4.35', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  plus: ['M12 5v14', 'M5 12h14'],
  home: ['M3 11.5 12 4l9 7.5', 'M5 10.5V20h5v-5h4v5h5v-9.5'],
  groups: ['M12 3 21 8v8l-9 5-9-5V8l9-5Z', 'M12 12 21 8', 'M12 12v9', 'M12 12 3 8'],
  contribution: ['M12 19V5', 'M6 11l6-6 6 6', 'M5 19h14'],
  calendar: ['M7 3v4', 'M17 3v4', 'M4 8h16', 'M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z'],
  more: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  money: ['M4 7h16v10H4z', 'M8 12h.01', 'M16 12h.01', 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z'],
  bank: ['M3 9 12 4l9 5', 'M5 10h14', 'M6 10v8', 'M10 10v8', 'M14 10v8', 'M18 10v8', 'M4 18h16'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  warning: ['M12 4 22 20H2L12 4Z', 'M12 9v4', 'M12 17h.01'],
  clock: ['M12 6v6l4 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  users: ['M16 21a6 6 0 0 0-12 0', 'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21a5 5 0 0 0-5-5', 'M17 3a4 4 0 0 1 0 8'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  clipboard: ['M9 4h6l1 2h3v15H5V6h3l1-2Z', 'M9 12h6', 'M9 16h4'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3Z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  message: ['M21 12a8 8 0 0 1-8 8H6l-3 3v-7a8 8 0 1 1 18-4Z'],
  chart: ['M4 19V5', 'M4 19h16', 'M8 16v-5', 'M12 16V8', 'M16 16v-8'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.2-2 2-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-3v-.8a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-2 .1-.2A1.7 1.7 0 0 0 6 15.1a1.7 1.7 0 0 0-1.5-1H4v-3h.5a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.2 2-2 .2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3v.8a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 2-.1.2a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.6v3h-.6a1.7 1.7 0 0 0-1.5 1Z'],
  book: ['M4 5a3 3 0 0 1 3-3h13v18H7a3 3 0 0 0-3 3V5Z', 'M4 19a3 3 0 0 1 3-3h13'],
  briefcase: ['M9 6V4h6v2', 'M4 7h16v12H4z', 'M4 12h16', 'M10 12v2h4v-2'],
  mail: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  scale: ['M12 3v18', 'M5 6h14', 'M6 6l-3 6h6L6 6Z', 'M18 6l-3 6h6l-3-6Z'],
  lock: ['M7 11V8a5 5 0 0 1 10 0v3', 'M5 11h14v10H5z'],
  help: ['M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-.9.7-1.8 1.3-1.8 2.8', 'M12 17h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  phone: ['M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z', 'M11 18h2'],
  monitor: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  lightning: ['M13 2 4 14h7l-1 8 10-13h-7l0-7Z'],
  offline: ['M3 3l18 18', 'M7.5 7.5A6 6 0 0 1 18 12c0 1.2-.4 2.3-1 3.2', 'M8 16a4 4 0 0 1-.7-5.7'],
  send: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4 20-7Z'],
  camera: ['M4 7h4l2-3h4l2 3h4v13H4z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  globe: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  location: ['M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z', 'M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  trophy: ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0V4Z', 'M7 6H4a3 3 0 0 0 3 3', 'M17 6h3a3 3 0 0 1-3 3'],
  rotate: ['M21 12a9 9 0 0 1-15 6.7L4 17', 'M3 12a9 9 0 0 1 15-6.7L20 7', 'M4 21v-4h4', 'M20 3v4h-4'],
  trend: ['M3 17l6-6 4 4 7-8', 'M14 7h6v6'],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z'],
  ai: ['M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2Z', 'M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z'],
  handshake: ['M8 12l3 3a2 2 0 0 0 3 0l4-4', 'M2 12l4-4 4 4', 'M22 12l-4-4-5 5', 'M7 17l-2 2', 'M17 17l2 2'],
  rocket: ['M5 19c2-5 6-11 14-14 0 8-9 13-14 14Z', 'M9 15l-4 4', 'M14 6h4v4', 'M6 14l-3-1 4-4', 'M10 18l1 3 4-4'],
  link: ['M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1', 'M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1'],
  shield: ['M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z'],
  calculator: ['M6 3h12v18H6z', 'M9 7h6', 'M9 11h.01', 'M12 11h.01', 'M15 11h.01', 'M9 15h.01', 'M12 15h.01', 'M15 15h.01', 'M9 18h6'],
  plane: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4 20-7Z'],
  gift: ['M20 12v9H4v-9', 'M2 7h20v5H2z', 'M12 7v14', 'M12 7H8.5a2.5 2.5 0 1 1 2-4c1 1.3 1.5 4 1.5 4Z', 'M12 7h3.5a2.5 2.5 0 1 0-2-4c-1 1.3-1.5 4-1.5 4Z'],
  car: ['M5 17h14l-1-5H6l-1 5Z', 'M7 17v2', 'M17 17v2', 'M7 12l2-5h6l2 5', 'M8 15h.01', 'M16 15h.01'],
  heart: ['M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
  circle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M6 15l6-6 6 6'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
  microphone: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z','M5 11v1a7 7 0 0 0 14 0v-1','M12 19v3','M8 22h8'],
  stop: ['M6 6h12v12H6z'],
  reply: ['M9 7l-5 5 5 5','M4 12h9a7 7 0 0 1 7 7'],
  pin: ['M9 3h6','M10 3v6l-3 4h10l-3-4V3','M12 13v8'],
  trash: ['M4 7h16','M9 7V4h6v3','M7 7l1 14h8l1-14','M10 11v6','M14 11v6'],
};

const GROUP_ICON_MAP = {
  ['\u{1F3D8}']: 'groups',
  ['\u{1F3E0}']: 'groups',
  ['\u2B21']: 'groups',
  ['\u{1F465}']: 'users',
  ['\u{1F4B0}']: 'money',
  ['\u{1F4B8}']: 'money',
  ['\u{1F3E6}']: 'bank',
  ['\u{1F4B3}']: 'card',
  ['\u{1F4CB}']: 'clipboard',
  ['\u{1F4C5}']: 'calendar',
  ['\u{1F4AC}']: 'message',
  ['\u{1F4CA}']: 'chart',
  ['\u{1F514}']: 'bell',
  ['\u2699\uFE0F']: 'settings',
  ['\u2699']: 'settings',
  ['\u{1F464}']: 'user',
  ['\u{1F4D6}']: 'book',
  ['\u2709\uFE0F']: 'mail',
  ['\u2696\uFE0F']: 'scale',
  ['\u{1F512}']: 'lock',
  ['\u2753']: 'help',
  ['\u{1F4F2}']: 'phone',
  ['\u{1F30D}']: 'globe',
  ['\u{1F680}']: 'rocket',
  ['\u{1F517}']: 'link',
  ['\u{1F510}']: 'shield',
};

export function iconNameFromValue(value, fallback = 'groups') {
  const key = String(value || '').trim();
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === 'home') return 'groups';
  return ICONS[normalizedKey] ? normalizedKey : ICONS[key] ? key : GROUP_ICON_MAP[key] || fallback;
}

export function groupIconNameFromValue(value, groupName = '', fallback = 'groups') {
  const explicitIcon = iconNameFromValue(value, '');
  if (explicitIcon && explicitIcon !== 'groups') return explicitIcon;

  const haystack = `${groupName || ''} ${value || ''}`.toLowerCase();
  const rules = [
    { icon: 'plane', words: ['trip', 'travel', 'holiday', 'vacation', 'journey', 'tour', 'flight', 'airport'] },
    { icon: 'gift', words: ['xmas', 'xmax', 'christmas', 'birthday', 'gift', 'party', 'celebration', 'festival'] },
    { icon: 'home', words: ['home', 'house', 'rent', 'mortgage', 'family circle', 'family'] },
    { icon: 'car', words: ['car', 'vehicle', 'transport', 'taxi', 'bus', 'motor'] },
    { icon: 'bank', words: ['bank', 'payout', 'salary', 'wage', 'payday'] },
    { icon: 'money', words: ['ajo', 'saving', 'savings', 'money', 'cash', 'thrift', 'contribution', 'wallet'] },
    { icon: 'users', words: ['friends', 'members', 'team', 'club', 'community', 'cooperative', 'coop'] },
    { icon: 'briefcase', words: ['work', 'business', 'office', 'staff', 'company'] },
    { icon: 'book', words: ['school', 'education', 'student', 'study', 'lesson'] },
    { icon: 'heart', words: ['health', 'medical', 'care', 'support'] },
    { icon: 'calendar', words: ['monthly', 'weekly', 'daily', 'cycle', 'round'] },
  ];

  return rules.find(rule => rule.words.some(word => haystack.includes(word)))?.icon || fallback;
}
export default function SvgIcon({ name = 'circle', size = 20, strokeWidth = 2, title, className = '', style }) {
  const paths = ICONS[name] || ICONS.circle;
  return (
    <svg
      className={`svg-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={style}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, index) => <path key={`${name}-${index}`} d={d} />)}
    </svg>
  );
}

