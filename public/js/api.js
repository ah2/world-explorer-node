const API = {
  base: '/api',
  async request(path, options = {}) {
    const res = await fetch(this.base + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  },
  get(p)        { return this.request(p); },
  post(p, d)    { return this.request(p, { method: 'POST',   body: JSON.stringify(d) }); },
  del(p)        { return this.request(p, { method: 'DELETE' }); },

  // Auth
  me()          { return this.get('/auth/me'); },
  login(c)      { return this.post('/auth/login', c); },
  register(u)   { return this.post('/auth/register', u); },
  logout()      { return this.post('/auth/logout'); },
  setCity(c)    { return this.post('/user/city', c); },

  // Data
  places(q)     { return this.get('/places?' + new URLSearchParams(q)); },
  categories()  { return this.get('/categories'); },
  cities()      { return this.get('/cities'); },
  collections() { return this.get('/user/collections'); },
  collect(p)    { return this.post('/places/collect', p); }
};

window.API = API;