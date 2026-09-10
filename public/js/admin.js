/* =============================================================================
   Admin panel — users, collections, and per-category point values.
   Assumes auth.js is NOT loaded on this page; handles its own auth check.
   ============================================================================= */

(async function () {
  const $ = id => document.getElementById(id);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------------------
  // Auth check — bounce non-admins before anything else runs
  // ---------------------------------------------------------------------------
  let me;
  try {
    const r = await API.me();
    me = r.user;
    if (!me.is_admin) throw new Error('not admin');
  } catch {
    location.href = '/login';
    return;
  }

  const ud = $('user-display');
  if (ud) { ud.textContent = '👤 ' + me.username; ud.classList.remove('hidden'); }

  $('signout-btn')?.addEventListener('click', async () => {
    try { await API.logout(); } catch {}
    location.href = '/login';
  });

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  async function loadUsers() {
    try {
      const { users } = await API.get('/admin/users');
      $('users-body').innerHTML = users.map(u => `
        <tr>
          <td>${u.id}</td>
          <td>${esc(u.username)}</td>
          <td>${esc(u.email)}</td>
          <td>${esc(u.city || '—')}</td>
          <td>${u.is_admin ? '✅' : '—'}</td>
          <td>${u.collected_count}</td>
          <td>${u.total_points}</td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');

      $('s-users').textContent = users.length;
      $('s-pts').textContent   = users.reduce((s, u) => s + u.total_points, 0);
    } catch (err) {
      $('users-body').innerHTML =
        `<tr><td colspan="8" class="muted">⚠️ ${esc(err.message)}</td></tr>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------
  async function loadCollections() {
    try {
      const { collections } = await API.get('/admin/collections');
      $('coll-body').innerHTML = collections.map(c => `
        <tr>
          <td>${c.id}</td>
          <td>${esc(c.username)}</td>
          <td>${esc(c.place_name || c.place_id)}</td>
          <td>${esc(c.place_category || '—')}</td>
          <td>${c.points}</td>
          <td>${new Date(c.collected_at).toLocaleString()}</td>
          <td>
            <button class="btn btn-danger del" data-id="${c.id}">Delete</button>
          </td>
        </tr>
      `).join('');

      $('s-coll').textContent = collections.length;

      document.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this collection entry?')) return;
          try {
            await API.del('/admin/collections/' + btn.dataset.id);
            loadCollections();
            loadUsers();
          } catch (err) {
            alert('Failed: ' + err.message);
          }
        });
      });
    } catch (err) {
      $('coll-body').innerHTML =
        `<tr><td colspan="7" class="muted">⚠️ ${esc(err.message)}</td></tr>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Category points
  // ---------------------------------------------------------------------------
  let currentPoints = {};

  function cssEsc(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  async function loadCategoryPoints() {
    try {
      const { points } = await API.get('/admin/category-points');
      currentPoints = points || {};
      renderCategoryPoints();
    } catch (err) {
      $('cat-points-body').innerHTML =
        `<tr><td colspan="3" class="muted">⚠️ ${esc(err.message)}</td></tr>`;
    }
  }

  function renderCategoryPoints() {
    const tbody = $('cat-points-body');
    const entries = Object.entries(currentPoints)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">No categories yet.</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(([cat, pts]) => `
      <tr>
        <td>${esc(cat)}</td>
        <td>
          <input type="number" min="0" max="9999" value="${pts}"
                 data-cat="${esc(cat)}" class="pts-input">
        </td>
        <td>
          <button class="btn btn-admin save-pts" data-cat="${esc(cat)}">Save</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.save-pts').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cat = btn.dataset.cat;
        const input = tbody.querySelector(`.pts-input[data-cat="${cssEsc(cat)}"]`);
        const points = parseInt(input.value, 10);
        if (isNaN(points) || points < 0 || points > 9999) {
          alert('Points must be between 0 and 9999.');
          return;
        }
        try {
          const r = await API.post('/admin/category-points', { category: cat, points });
          currentPoints = r.points || currentPoints;
          const orig = btn.textContent;
          btn.textContent = '✓ Saved';
          setTimeout(() => { btn.textContent = orig; }, 1200);
        } catch (err) {
          alert('Failed: ' + err.message);
        }
      });
    });
  }

  $('add-category-btn')?.addEventListener('click', async () => {
    const cat = prompt('Category name (lowercase, e.g. "cafe"):');
    if (!cat) return;
    const name = cat.trim().toLowerCase();
    if (!name) return;
    if (currentPoints[name] != null) {
      alert('Category already exists — edit its value in the table.');
      return;
    }
    try {
      const r = await API.post('/admin/category-points', { category: name, points: 10 });
      currentPoints = r.points || currentPoints;
      renderCategoryPoints();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  loadUsers();
  loadCollections();
  loadCategoryPoints();
})();