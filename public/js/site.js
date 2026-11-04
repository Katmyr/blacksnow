// Menu mobile (toutes les pages)
(function () {
  const menu = document.getElementById('mobileMenu');
  const openBtn = document.getElementById('openMenu');
  const closeBtn = document.getElementById('closeMenu');
  if (!menu || !openBtn) return;
  const set = open => {
    menu.classList.toggle('active', open);
    menu.setAttribute('aria-hidden', String(!open));
    openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) closeBtn.focus(); else openBtn.focus();
  };
  openBtn.addEventListener('click', () => set(true));
  closeBtn.addEventListener('click', () => set(false));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('active')) set(false); });
})();

