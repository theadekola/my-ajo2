export function formatPaymentMethod(method) {
  const raw = String(method || '').trim();
  if (!raw) return 'Payment';

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}