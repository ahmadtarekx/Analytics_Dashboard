/**
 * apiClient.js — Centralized HTTP client (Repository Pattern foundation)
 *
 * Single source of truth for all fetch calls.
 * Every repository imports this instead of calling fetch() directly.
 * To swap base URL or add global headers (e.g. JWT), edit this file only.
 */

export const BASE_URL = 'http://localhost:3000/api';

class ApiClient {
  async request(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    const config = {
      ...options,
      headers: { ...defaultHeaders, ...(options.headers || {}) },
    };

    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data.error || data.message || `HTTP ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  get(url, params = {}) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const fullUrl = query ? `${url}?${query}` : url;
    return this.request(fullUrl, { method: 'GET' });
  }

  post(url, body) {
    return this.request(url, { method: 'POST', body: JSON.stringify(body) });
  }

  patch(url, body) {
    return this.request(url, { method: 'PATCH', body: JSON.stringify(body) });
  }

  delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
