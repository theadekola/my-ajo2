const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
// Remove tokens left by pre-cookie web releases. Browser authentication is cookie-only.
try { localStorage.removeItem('myajo_token'); } catch { /* Storage may be unavailable. */ }
export const apiUrl = path => `${API_BASE_URL}${path}`;
export const apiAssetUrl = path => {
  if (!path || typeof path !== 'string') return path;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

let csrfToken = '';
let csrfRequest = null;
const unsafeMethod = method => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase());

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    csrfRequest = fetch(apiUrl('/api/csrf'), { credentials: 'include', signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.csrfToken) throw new Error(data.error || 'Could not establish request security');
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .catch(error => { if (error?.name === 'AbortError') throw new Error('Could not establish request security: server timeout'); throw error; })
      .finally(() => { clearTimeout(timeout); csrfRequest = null; });
  }
  return csrfRequest;
}

export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (unsafeMethod(opts.method) && opts.csrf !== false) headers['X-CSRF-Token'] = await getCsrfToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(apiUrl(`/api${path}`), { ...opts, headers, credentials: 'include', signal: opts.signal || controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('The server did not respond within 20 seconds. Please retry.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (opts.rawResponse) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { code: data.code, status: res.status });
  return data;
}

export async function apiUpload(path, formData) {
  const headers = {};
  headers['X-CSRF-Token'] = await getCsrfToken();
  const res = await fetch(apiUrl(`/api${path}`), { method: 'POST', headers, body: formData, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { code: data.code, status: res.status });
  return data;
}

export const apiGet = p => api(p);
export const apiPost = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) });
export const apiPublicPost = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b), csrf: false });
export const apiPut = (p, b) => api(p, { method: 'PUT', body: JSON.stringify(b) });
export const apiDelete = (p, b) => api(p, { method: 'DELETE', body: b ? JSON.stringify(b) : undefined });
