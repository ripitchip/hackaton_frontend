// Import Chart.js
import Chart from 'chart.js/auto';

// normalize API response into an array of user objects
function normalizeUsers(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.users)) return payload.users;
  if (Array.isArray(payload.data)) return payload.data;
  // if payload is an object map, return its values
  if (typeof payload === 'object') return Object.values(payload);
  return [];
}

// Render the list of user cards
function renderStats(users) {
  const statsRoot = document.getElementById('stats-root');
  statsRoot.innerHTML = '';

  if (!users || users.length === 0) {
    statsRoot.innerHTML = '<div class="empty">No users found.</div>';
    return;
  }

  users.forEach(user => {
    const name = user.name || user.fullName || user.username || 'Unknown';
    const projects = (user.projects !== undefined && user.projects !== null) ? user.projects : 0;
    const tasks = (user.tasks !== undefined && user.tasks !== null) ? user.tasks : 0;

    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="avatar">${(name && name[0]) || '?'}</div>
      <div class="person-meta">
        <div class="person-name">${name}</div>
        <div class="person-role">${user.role || ''}</div>
        <div class="person-stats">
          <span>${projects} projects</span>
          <span>${tasks} tasks</span>
        </div>
      </div>
    `;
    statsRoot.appendChild(card);
  });
}

// Render a bar chart with projects and tasks per user
let currentChart = null;
function renderChart(users) {
  // destroy previous chart if exists
  if (currentChart) {
    try { currentChart.destroy(); } catch (e) { /* ignore */ }
    currentChart = null;
  }

  const statsRoot = document.getElementById('stats-root');
  const chartContainer = document.createElement('div');
  chartContainer.style.width = '100%';
  chartContainer.style.maxWidth = '900px';
  chartContainer.style.margin = '20px auto';
  const canvas = document.createElement('canvas');
  chartContainer.appendChild(canvas);
  statsRoot.appendChild(chartContainer);

  const ctx = canvas.getContext('2d');
  const labels = users.map(u => u.name || u.fullName || u.username || 'Unknown');
  const projectData = users.map(u => Number((u.projects !== undefined && u.projects !== null) ? u.projects : 0));
  const taskData = users.map(u => Number((u.tasks !== undefined && u.tasks !== null) ? u.tasks : 0));

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Projects',
          data: projectData,
          backgroundColor: 'rgba(54, 162, 235, 0.6)'
        },
        {
          label: 'Tasks',
          data: taskData,
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'User Projects and Tasks' }
      }
    }
  });
}

// Main fetch + wiring
async function fetchUsers() {
  const userSelect = document.getElementById('user-select');
  const statsRoot = document.getElementById('stats-root');

  if (!userSelect || !statsRoot) {
    console.error('Missing #user-select or #stats-root in DOM');
    return;
  }

  try {
    statsRoot.innerHTML = '<div class="empty">Loading stats…</div>';

    const res = await fetch('http://localhost:8000/users/', { headers: { accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + ' ' + res.statusText + ' ' + text);
    }

    const payload = await res.json();
    console.log('users payload:', payload);
    const users = normalizeUsers(payload);

    if (!users || users.length === 0) {
      statsRoot.innerHTML = '<div class="empty">No users returned by API.</div>';
      return;
    }

    // reset select but keep the All option
    const allOption = document.createElement('option');
    allOption.value = '__all';
    allOption.textContent = 'All people';
    userSelect.innerHTML = '';
    userSelect.appendChild(allOption);

    users.forEach(user => {
      const name = user.name || user.fullName || user.username || '';
      const option = document.createElement('option');
      // prefer name for value because API single-user endpoint expects a name in the path
      option.value = name || (user.id || '');
      option.textContent = name || (user.id || '(unknown)');
      userSelect.appendChild(option);
    });

    // initial render
    renderStats(users);
    renderChart(users);

    // selection change: either show all or fetch single user
    userSelect.addEventListener('change', async () => {
      const val = userSelect.value;
      if (!val || val === '__all') {
        renderStats(users);
        renderChart(users);
        return;
      }

      // try to fetch single user by name (as provided)
      try {
        statsRoot.innerHTML = '<div class="empty">Loading user…</div>';
        const singleRes = await fetch('http://localhost:8000/users/' + encodeURIComponent(val), { headers: { accept: 'application/json' } });
        if (!singleRes.ok) throw new Error('HTTP ' + singleRes.status);
        const singlePayload = await singleRes.json();
        console.log('single user payload:', singlePayload);
        const singleUsers = normalizeUsers(singlePayload);
        // single endpoint may return object; normalize to array
        const toShow = (singleUsers && singleUsers.length) ? singleUsers : (Array.isArray(singlePayload) ? singlePayload : [singlePayload]);
        renderStats(toShow);
        renderChart(toShow);
      } catch (err) {
        console.error('Failed to fetch single user:', err);
        // fallback: filter from already loaded users by name
        const fallback = users.filter(u => (u.name || u.fullName || u.username) === val);
        if (fallback.length) {
          renderStats(fallback);
          renderChart(fallback);
        } else {
          statsRoot.innerHTML = '<div class="empty">User data not available.</div>';
        }
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    statsRoot.innerHTML = '<div class="empty">Failed to load stats: ' + (error.message || error) + '</div>';
  }
}

// Initialize the page
fetchUsers();
