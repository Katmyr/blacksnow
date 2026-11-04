// Lecture des vidéos dans une modale (sans quitter le site)
(function () {
  const modal = document.getElementById('yt-modal');
  const iframe = document.getElementById('yt-iframe');
  const closeBtn = document.getElementById('modal-close');
  let lastFocus = null;

  function open(id) {
    lastFocus = document.activeElement;
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function close() {
    modal.classList.remove('active');
    iframe.src = '';
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  document.querySelectorAll('[data-video]').forEach(a => a.addEventListener('click', e => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return; // laisser ouvrir dans un onglet
    e.preventDefault();
    open(a.dataset.video);
  }));
  document.querySelectorAll('.yt-thumb').forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true }));
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) close(); });
})();
