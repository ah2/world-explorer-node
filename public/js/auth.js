(async function () {
  const $ = id => document.getElementById(id);
  const userDisplay = $('user-display');
  const loginBtn    = $('login-btn');            // may be null on some pages
  const signoutBtn  = $('signout-btn');
  const adminLink   = $('admin-link');
  const collLink    = $('collections-link');

  function hideAll() {
    adminLink?.classList.add('hidden');
    collLink?.classList.add('hidden');
    if (signoutBtn) signoutBtn.style.display = 'none';
    if (loginBtn)   loginBtn.style.display = 'inline-block';
  }

  function showAuthed(user) {
    if (userDisplay) userDisplay.textContent = '👤 ' + user.username;

    if (signoutBtn) signoutBtn.style.display = 'inline-block';
    if (loginBtn)   loginBtn.style.display = 'none';

    // Every logged-in user gets Collections
    collLink?.classList.remove('hidden');

    // Admins also get the Admin Panel button
    if (user.is_admin) adminLink?.classList.remove('hidden');
    else               adminLink?.classList.add('hidden');
  }

  // Sign out (works whether or not the button exists on the page)
  signoutBtn?.addEventListener('click', async () => {
    try { await API.logout(); } catch {}
    location.href = '/login';
  });

  try {
    const { user } = await API.me();
    window.currentUser = user;
    showAuthed(user);

    // If we're on a page that requires admin and we're not admin, bounce
    if (location.pathname.startsWith('/admin') && !user.is_admin) {
      location.href = '/';
      return;
    }
  } catch {
    // Not logged in → either go to /login or run in guest mode
    window.currentUser = null;
    hideAll();
    const isGuest = new URLSearchParams(location.search).get('guest');
    if (!isGuest && location.pathname !== '/login') location.href = '/login';
  }
})();