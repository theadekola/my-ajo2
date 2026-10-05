export const PENDING_INVITE_KEY = 'myajo_pending_invite';

export function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase();
}

export function inviteJoinPath(inviteCode) {
  const normalized = normalizeInviteCode(inviteCode);
  return normalized ? `/groups?invite=${encodeURIComponent(normalized)}` : '/dashboard';
}

export function savePendingInvite(value) {
  const inviteCode = normalizeInviteCode(value);
  if (!inviteCode || typeof window === 'undefined') return '';
  try {
    window.localStorage.setItem(PENDING_INVITE_KEY, inviteCode);
  } catch {
    // Ignore private browsing or storage restrictions.
  }
  return inviteCode;
}

export function readPendingInvite() {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeInviteCode(window.localStorage.getItem(PENDING_INVITE_KEY));
  } catch {
    return '';
  }
}

export function clearPendingInvite() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Ignore private browsing or storage restrictions.
  }
}
