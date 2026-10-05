const ICON_ALIASES = new Map([
  ['\u{1F3D8}', 'home'],
  ['\u{1F3E0}', 'home'],
  ['\u2B21', 'groups'],
  ['\u{1F465}', 'users'],
  ['\u{1F4B0}', 'money'],
  ['\u{1F4B8}', 'money'],
  ['\u{1F3E6}', 'bank'],
  ['\u{1F4B3}', 'card'],
  ['\u{1F4CB}', 'clipboard'],
  ['\u{1F4C5}', 'calendar'],
  ['\u{1F4AC}', 'message'],
  ['\u{1F4CA}', 'chart'],
  ['\u{1F514}', 'bell'],
  ['\u2699\uFE0F', 'settings'],
  ['\u2699', 'settings'],
  ['\u{1F464}', 'user'],
  ['\u{1F4D6}', 'book'],
  ['\u2709\uFE0F', 'mail'],
  ['\u2696\uFE0F', 'scale'],
  ['\u{1F512}', 'lock'],
  ['\u2753', 'help'],
  ['\u{1F4F2}', 'phone'],
  ['\u{1F30D}', 'globe'],
  ['\u{1F680}', 'rocket'],
  ['\u{1F517}', 'link'],
  ['\u{1F510}', 'shield'],
  ['\u{1F4BC}', 'briefcase'],
  ['\u{1F393}', 'book'],
]);

export function normalizeIconValue(value, fallback = 'groups') {
  const key = String(value || '').trim();
  if (!key) return fallback;
  return ICON_ALIASES.get(key) || key;
}

export function normalizeIconRecord(record) {
  if (!record || !Object.prototype.hasOwnProperty.call(record, 'Icon')) return record;
  return { ...record, Icon: normalizeIconValue(record.Icon) };
}

export function normalizeIconRecords(records = []) {
  return records.map(normalizeIconRecord);
}