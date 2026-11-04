// Overlay galerie d'un membre + lightbox
(function () {
  const data = JSON.parse(document.getElementById('gallery-data').textContent || '{}');
  const overlay = document.getElementById('gallery-overlay');
  const title = document.getElementById('gal-title');
  const grid = document.getElementById('gal-grid');
  const empty = document.getElementById('gal-empty');
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCap = document.getElementById('lb-cap');
  const lbCount = document.getElementById('lb-count');
  let photos = [], current = 0, lastFocus = null, memberName = '';

  function openGallery(id) {
    const g = data[id];
    if (!g) return;
    lastFocus = document.activeElement;
    memberName = g.name;
    photos = g.photos;
    title.textContent = g.name;
    document.getElementById('gal-file').textContent = `photos_${g.name}.exe`;
    const av = document.getElementById('gal-avatar');
    av.src = g.avatar; av.alt = g.name;
    document.getElementById('gal-meta').innerHTML =
      g.roles.map(r => `<span class="role-chip">${r.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</span>`).join('') +
      `<span>${photos.length} photo${photos.length > 1 ? 's' : ''}</span>`;
    grid.innerHTML = '';
    photos.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Agrandir la photo ${i + 1}${p.l ? ' : ' + p.l : ''}`);
      const img = document.createElement('img');
      if (p.w && p.h) { img.width = p.w; img.height = p.h; }
      img.alt = p.l || `${g.name} avec BLACKSNOW`; img.loading = 'lazy';
      img.onload = () => img.classList.add('loaded');
      img.src = p.m;
      b.appendChild(img);
      if (p.l) { const c = document.createElement('span'); c.className = 'gal-cap'; c.textContent = p.l; b.appendChild(c); }
      b.addEventListener('click', () => openLightbox(i));
      grid.appendChild(b);
    });
    empty.hidden = photos.length > 0;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    history.replaceState(null, '', `#galerie-${id}`);
    overlay.querySelector('[data-close]').focus();
  }
  function closeGallery() {
    overlay.hidden = true;
    history.replaceState(null, '', location.pathname);
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function show(i) {
    current = (i + photos.length) % photos.length;
    const p = photos[current];
    lbImg.src = p.u;
    lbImg.alt = p.l || `${memberName} avec BLACKSNOW`;
    lbCap.textContent = p.l || '';
    lbCount.textContent = `${current + 1} / ${photos.length}`;
    const multi = photos.length > 1;
    lb.querySelector('.lb-prev').hidden = !multi;
    lb.querySelector('.lb-next').hidden = !multi;
    strip.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === current)));
    strip.children[current]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  const strip = document.getElementById('lb-strip');
  function buildStrip() {
    strip.innerHTML = '';
    strip.hidden = photos.length < 2;
    photos.forEach((p, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', `Photo ${k + 1}`);
      b.innerHTML = `<img src="${p.m}" alt="" loading="lazy">`;
      b.onclick = () => show(k);
      strip.appendChild(b);
    });
  }
  function openLightbox(i) { buildStrip(); show(i); lb.hidden = false; lb.querySelector('.lb-close').focus(); }
  function closeLightbox() { lb.hidden = true; const b = grid.children[current]; if (b) b.focus(); }

  // Ouverture : clic sur la carte (hors liens réseaux) ou sur le bouton "X photos"
  document.querySelectorAll('.member-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      openGallery(card.dataset.member);
    });
  });
  overlay.querySelector('[data-close]').addEventListener('click', closeGallery);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeGallery(); });
  lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
  lb.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
  lb.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  // Swipe mobile
  let x0 = null;
  lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  document.addEventListener('keydown', e => {
    if (!lb.hidden) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') show(current + 1);
      else if (e.key === 'ArrowLeft') show(current - 1);
    } else if (!overlay.hidden && e.key === 'Escape') closeGallery();
  });

  // Lien direct partageable : /membres#galerie-<id>
  const m = location.hash.match(/^#galerie-([\w-]+)$/);
  if (m) openGallery(m[1]);
})();

// Extrait musical (30 s) : un seul à la fois
(function () {
  const audio = new Audio();
  audio.preload = 'none';
  let currentBtn = null;
  const RING = '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg>';
  const setIcon = (btn, icon) => { btn.querySelector('.material-icons').textContent = icon; };

  function stop() {
    audio.pause();
    if (currentBtn) { currentBtn.classList.remove('playing', 'loading'); setIcon(currentBtn, 'play_arrow'); currentBtn.querySelector('svg')?.remove(); }
    currentBtn = null;
  }
  audio.addEventListener('ended', stop);
  audio.addEventListener('timeupdate', () => {
    const c = currentBtn?.querySelector('circle');
    if (c && audio.duration) c.style.strokeDashoffset = String(100.5 * (1 - audio.currentTime / audio.duration));
  });

  document.querySelectorAll('[data-preview]').forEach(btn => btn.addEventListener('click', async e => {
    e.stopPropagation(); // ne pas ouvrir la galerie
    if (currentBtn === btn) return stop();
    stop();
    currentBtn = btn;
    btn.classList.add('loading');
    try {
      if (!btn.dataset.src) {
        const r = await fetch(`/api/preview/${btn.dataset.preview}`);
        if (!r.ok) throw new Error();
        btn.dataset.src = (await r.json()).preview;
      }
      if (currentBtn !== btn) return;
      audio.src = btn.dataset.src;
      await audio.play();
      btn.classList.remove('loading'); btn.classList.add('playing');
      setIcon(btn, 'pause');
      btn.insertAdjacentHTML('beforeend', RING);
    } catch {
      btn.classList.remove('loading'); btn.classList.add('error');
      btn.title = 'Extrait indisponible';
      delete btn.dataset.src;
      currentBtn = null;
    }
  }));
})();
