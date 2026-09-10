const DEFAULT_PASSWORD = 'password123';
const ADMIN_PASSWORD = 'admin123';
const ADMINS = new Set(['admin']);

// If already logged in, redirect
API.me().then(() => location.href = '/').catch(() => {});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('form-login').classList.toggle('hidden', !isLogin);
    document.getElementById('form-register').classList.toggle('hidden', isLogin);
  });
});

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await API.login(data);
    location.href = '/';
  } catch (err) { showError(err.message); }
});

document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await API.register(data);
    location.href = '/';
  } catch (err) { showError(err.message); }
});

// Quick-login buttons for seeded users
(async () => {
  const grid = document.getElementById('quick-users');
  try {
    const { users } = await API.get('/auth/seeded-users');
    grid.innerHTML = users.map(u => `
      <button class="quick-btn" data-username="${u.username}">
        ${ADMINS.has(u.username) ? '👑' : '👤'} ${u.username}
      </button>
    `).join('');
    grid.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const username = btn.dataset.username;
        const password = ADMINS.has(username) ? ADMIN_PASSWORD : DEFAULT_PASSWORD;
        try {
          await API.login({ username, password });
          location.href = '/';
        } catch (err) { showError(err.message); }
      });
    });
  } catch {}
})();