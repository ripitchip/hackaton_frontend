const sidebar = document.querySelector('.sidebar');
const closeBtn = document.querySelector('#btn');
const searchBtn = document.querySelector('.bx-search');

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    menuBtnChange();
  });
}

if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    menuBtnChange();
  });
}

function menuBtnChange() {
  if (!sidebar) return;
  if (sidebar.classList.contains('open')) {
    closeBtn.classList.replace('bx-menu', 'bx-menu-alt-right');
  } else {
    closeBtn.classList.replace('bx-menu-alt-right', 'bx-menu');
  }
}

// mark the active page link with a visible 'white hollow' outline
function markActiveLink() {
  if (!window || !document) return;
  const anchors = document.querySelectorAll('.nav-list a');
  const current = (location.pathname || '/').replace(/\/+$|^$/, (s)=> s === '' ? '/' : '');
  anchors.forEach((a) => {
    try {
      const aUrl = new URL(a.href, location.origin);
      const aPath = (aUrl.pathname || '/').replace(/\/+$|^$/, (s)=> s === '' ? '/' : '');
      if (aPath === current) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      } else {
        a.classList.remove('active');
        a.removeAttribute('aria-current');
      }
    } catch (e) {
      // ignore malformed hrefs
    }
  });
}

// run once on load
markActiveLink();
