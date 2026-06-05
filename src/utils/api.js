const SESSION_KEY = 'crm_current_user';

export async function apiRequest(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      headers['X-User-Id'] = String(user.id);
      headers['X-User-Role'] = user.role;
    }
  } catch {
    // ignore invalid session
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
