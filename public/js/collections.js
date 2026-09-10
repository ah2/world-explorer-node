const CAT = {
  restaurant:'🍽️', cafe:'☕', bakery:'🥐', bar:'🍺', brewery:'🍻', fast_food:'🍔',
  ice_cream:'🍦', park:'🌳', museum:'🏛️', art_gallery:'🎨', landmark:'🗿',
  viewpoint:'🔭', zoo:'🦁', aquarium:'🐟', shop:'🛍️', supermarket:'🛒',
  pharmacy:'💊', bank:'🏦', hotel:'🏨', cinema:'🎬', theatre:'🎭',
  library:'📚', school:'🎓', hospital:'🏥', default:'📍'
};
const emoji = c => CAT[(c || '').toLowerCase()] || CAT.default;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let allPlaces = [];
let activeFilter = '';

document.getElementById('signout-btn')?.addEventListener('click', async () => {
  await API.logout();
  location.href = '/login';
});

async function load() {
  try {
    const me = await API.me();
    document.getElementById('user-display').textContent = '👤 ' + me.user.username;
  } catch {
    location.href = '/login';
    return;
  }

  const data = await API.collections();
  allPlaces = data.places;

  document.getElementById('s-count').textContent = data.count;
  document.getElementById('s-points').textContent = data.totalPoints;
  document.getElementById('s-cats').textContent = Object.keys(data.byCategory).length;

  renderChips(data.byCategory);
  renderGrid();

  if (data.count === 0) document.getElementById('empty').classList.remove('hidden');
}

function renderChips(byCategory) {
  const el = document.getElementById('filter-chips');
  const total = Object.values(byCategory).reduce((s, n) => s + n, 0);
  let html = `<button class="chip ${activeFilter === '' ? 'active' : ''}" data-cat="">
                <span>All</span><span class="chip-count">${total}</span>
              </button>`;
  for (const [c, n] of Object.entries(byCategory).sort((a,b) => b[1] - a[1])) {
    html += `<button class="chip ${activeFilter === c ? 'active' : ''}" data-cat="${esc(c)}">
               <span>${emoji(c)} ${esc(c)}</span><span class="chip-count">${n}</span>
             </button>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    activeFilter = c.dataset.cat || '';
    renderChips(byCategory);
    renderGrid();
  }));
}

function renderGrid() {
  const list = activeFilter ? allPlaces.filter(p => p.category === activeFilter) : allPlaces;
  document.getElementById('grid').innerHTML = list.map(p => `
    <div class="coll-card">
      <div class="coll-icon">${emoji(p.category)}</div>
      <div class="coll-info">
        <div class="coll-name">${esc(p.name)}</div>
        <div class="coll-meta">${esc(p.category)}</div>
        <div class="coll-meta small">${new Date(p.collected_at).toLocaleDateString()}</div>
      </div>
      <div class="coll-points">+${p.points}</div>
    </div>
  `).join('');
}

load();