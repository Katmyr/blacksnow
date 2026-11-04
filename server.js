'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   BLACKSNOW — serveur du site + admin
   Lancement : node --env-file=.env server.js   →  http://localhost:3000
   Données   : data/*.json   |   Médias de l'admin : public/uploads/
   ═══════════════════════════════════════════════════════════════════════ */
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

// ── Configuration ──────────────────────────────────────────────────────
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const VIEWS_DIR = path.join(ROOT, 'views');
const SEED_DIR = path.join(ROOT, 'data-seed');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(PUBLIC_DIR, 'uploads'));
const TRASH_DIR = path.join(ROOT, '_archive', 'corbeille');
const PORT = Number(process.env.PORT) || 3000;
const SITE_URL = (process.env.SITE_URL || 'https://blacksnowdancecrew.fr').replace(/\/$/, '');
const YT_HANDLE = process.env.YT_HANDLE || 'blacksnow_dancecrew';
const IS_PROD = process.env.NODE_ENV === 'production';
const NEW_BADGE_DAYS = 45;
// Publication du site public (GitHub Pages)
const BUILD_DIR = path.resolve(process.env.BUILD_DIR || path.join(ROOT, '_build'));
const DEPLOY_REPO = process.env.DEPLOY_REPO || '';           // ex. git@github.com:asso/blacksnow.git (vide = build local seulement)
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'gh-pages';
const DEPLOY_SSH_KEY = process.env.DEPLOY_SSH_KEY || '';     // optionnel : chemin d'une clé SSH dédiée
const ADMIN_URL = (process.env.ADMIN_URL || '').replace(/\/$/, ''); // ex. https://blacksnow.alwaysdata.net
const CRON_TOKEN = process.env.CRON_TOKEN || '';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (ADMIN_PASSWORD.length < 12) {
  console.error('✖ ADMIN_PASSWORD manquant ou trop court (12 caractères minimum) dans le fichier .env');
  process.exit(1);
}
const SALT = crypto.randomBytes(16);
const PASS_HASH = crypto.scryptSync(ADMIN_PASSWORD, SALT, 64);

// ── Petite "base de données" JSON ──────────────────────────────────────
const COLLECTIONS = ['members', 'events', 'gallery', 'settings', 'videos'];
const db = {};

function loadData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const name of COLLECTIONS) {
    const file = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(file)) fs.copyFileSync(path.join(SEED_DIR, `${name}.json`), file);
    db[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  migrate();
}

// Convertit les données de l'ancienne version (rôle texte, réseaux fixes, thème, invités, statut)
function migrate() {
  const changed = new Set();
  for (const m of db.members) {
    if (typeof m.role === 'string') { m.roles = m.role.split('/').map(r => r.trim()).filter(Boolean); delete m.role; changed.add('members'); }
    if (m.socials && !Array.isArray(m.socials)) { m.socials = Object.values(m.socials).map(url => ({ url })); changed.add('members'); }
    if (m.songUrl === undefined) { m.songUrl = ''; changed.add('members'); }
    if ('statut' in m) {
      m.name = upper(m.name);
      m.published = m.statut === 'publie' ? snapshot(m, MEMBER_FIELDS) : null;
      m.publishedAt = m.published ? m.dateModification : null;
      delete m.statut; changed.add('members');
    }
  }
  for (const e of db.events) {
    if ('theme' in e) { e.sousTitre = e.theme; delete e.theme; changed.add('events'); }
    if ('invites' in e) {
      if (e.invites) e.description = `Avec ${e.invites}` + (e.description ? `\n\n${e.description}` : '');
      delete e.invites; changed.add('events');
    }
    if ('statut' in e) {
      e.published = e.statut === 'publie' ? snapshot(e, EVENT_FIELDS) : null;
      e.publishedAt = e.published ? e.dateModification : null;
      delete e.statut; changed.add('events');
    }
  }
  for (const c of changed) save(c);
}

let writeQueue = Promise.resolve();
function save(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  const content = JSON.stringify(db[name], null, 2);
  writeQueue = writeQueue.then(async () => {
    try {
      await fsp.writeFile(`${file}.tmp`, content);
      await fsp.rename(`${file}.tmp`, file);
    } catch {
      await fsp.writeFile(file, content); // repli Windows (EPERM/EBUSY)
    }
  }).catch(err => console.error('Sauvegarde impossible :', name, err));
  return writeQueue;
}

// ── Utilitaires ────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const newId = () => crypto.randomBytes(5).toString('hex');
const jsonForScript = x => JSON.stringify(x).replace(/</g, '\\u003c');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
const noStore = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

function media(u) {
  const v = String(u || '').replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  return /^(uploads|images)\/[A-Za-z0-9._\-/]+$/.test(v) && !v.includes('..') ? v : '';
}
function httpsUrl(u) {
  const v = str(u, 500);
  return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : '';
}
const todayParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
function parisISO(date, time) {
  if (!date) return '';
  const t = time || '00:00';
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${date}T${t}:00Z`)).find(p => p.type === 'timeZoneName')?.value || 'GMT+01:00';
  return `${date}T${t}:00${tz.replace('GMT', '') || '+00:00'}`;
}
const frDate = d => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
const frHour = h => h ? h.replace(/^0/, '').replace(':00', 'h').replace(':', 'h') : '';

// ── Authentification ───────────────────────────────────────────────────
const SESSION_MS = 24 * 3600e3;
const sessions = new Map();  // token -> { exp }
const failures = new Map();  // ip -> { count, until }

function checkPassword(p) {
  const h = crypto.scryptSync(String(p || ''), SALT, 64);
  return crypto.timingSafeEqual(h, PASS_HASH);
}
function requireAuth(req, res, next) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.get('authorization') || '');
  const s = m && sessions.get(m[1]);
  if (!s || s.exp < Date.now()) {
    if (m) sessions.delete(m[1]);
    return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' });
  }
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (s.exp < now) sessions.delete(t);
  for (const [ip, f] of failures) if (f.until && f.until < now) failures.delete(ip);
}, 3600e3).unref();

// ── Upload + compression (sharp) ───────────────────────────────────────
const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => cb(null, UPLOAD_DIR),
    filename: (req, f, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(f.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024, files: 60 },
  fileFilter: (req, f, cb) => IMG_EXT.includes(path.extname(f.originalname).toLowerCase())
    ? cb(null, true)
    : cb(httpError(400, `Format refusé pour « ${f.originalname} » (jpg, png, webp, avif).`)),
});

async function processImage(file) {
  let dims = {}, exifDate = '';
  const base = file.path.slice(0, -path.extname(file.path).length);
  try {
    const buffer = await fsp.readFile(file.path); // lecture en mémoire : évite EBUSY sous Windows
    const { format } = await sharp(buffer).metadata();
    if (!['jpeg', 'png', 'webp', 'heif'].includes(format)) throw new Error('format');
    const img = sharp(buffer, { failOn: 'none' }).rotate();
    await img.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 75 }).toFile(`${base}-1600.webp`);
    const info = await img.clone().resize({ width: 600, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`${base}-600.webp`);
    dims = { w: info.width, h: info.height };
    // Date de prise de vue (EXIF "AAAA:MM:JJ hh:mm:ss"), si présente
    const exif = (await sharp(buffer).metadata()).exif;
    const d = exif && exif.toString('latin1').match(/((?:19|20)\d{2}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/);
    if (d) exifDate = `${d[1]}-${d[2]}-${d[3]}`;
  } catch {
    throw httpError(400, `Image illisible : « ${file.originalname} ».`);
  } finally {
    try { await fsp.unlink(file.path); } catch {}
  }
  return { url: `uploads/${path.basename(base)}-1600.webp`, miniature: `uploads/${path.basename(base)}-600.webp`, ...dims, exifDate };
}
async function discardFiles(files = []) { for (const f of files) { try { await fsp.unlink(f.path); } catch {} } }

// ── Nettoyage des médias orphelins ─────────────────────────────────────
function urlsOf(obj, out = []) {
  for (const v of Object.values(obj || {})) {
    if (typeof v === 'string' && v.startsWith('uploads/')) out.push(v);
    else if (v && typeof v === 'object') urlsOf(v, out);
  }
  return out;
}
function usedUrls() {
  const s = new Set();
  for (const c of ['members', 'events', 'gallery']) for (const it of db[c]) urlsOf(it).forEach(u => s.add(u));
  return s;
}
async function deleteIfOrphan(urls) {
  const used = usedUrls();
  for (const u of urls) {
    if (used.has(u)) continue;
    try { await fsp.unlink(path.join(UPLOAD_DIR, path.basename(u))); } catch {}
  }
}
async function sweepUploads() {
  const used = usedUrls();
  const limit = Date.now() - 10 * 60e3;
  let moved = 0;
  for (const name of await fsp.readdir(UPLOAD_DIR)) {
    if (name.startsWith('.') || used.has(`uploads/${name}`)) continue;
    const p = path.join(UPLOAD_DIR, name);
    const st = await fsp.stat(p);
    if (!st.isFile() || st.mtimeMs > limit) continue;
    await fsp.mkdir(TRASH_DIR, { recursive: true });
    try { await fsp.rename(p, path.join(TRASH_DIR, name)); moved++; } catch {}
  }
  if (moved) console.log(`↳ ${moved} fichier(s) orphelin(s) déplacé(s) dans _archive/corbeille/`);
}

// ── Validation des contenus ────────────────────────────────────────────
// Chaque élément a une version de travail (champs à la racine, enregistrée automatiquement)
// et une version "published" (ce que voit le public), copiée uniquement sur action "Publier".
const MEMBER_FIELDS = ['name', 'roles', 'description', 'song', 'songUrl', 'photo', 'miniature', 'socials'];
const EVENT_FIELDS = ['titre', 'sousTitre', 'date', 'heureDebut', 'heureFin', 'lieu', 'adresse', 'description', 'lien', 'affiche', 'miniature'];
const FIELDS = { members: MEMBER_FIELDS, events: EVENT_FIELDS };
const upper = s => String(s || '').toLocaleUpperCase('fr-FR');
const snapshot = (item, fields) => JSON.parse(JSON.stringify(Object.fromEntries(fields.map(f => [f, item[f] ?? null]))));
const etatOf = (item, fields) => !item.published ? 'brouillon'
  : JSON.stringify(snapshot(item, fields)) === JSON.stringify(snapshot(item.published, fields)) ? 'publie' : 'modifie';
const decorate = (name, item) => ({ ...item, etat: etatOf(item, FIELDS[name]) });

const PLATFORMS = [
  ['instagram.com', 'fab fa-instagram', 'Instagram'], ['tiktok.com', 'fab fa-tiktok', 'TikTok'],
  ['youtube.com', 'fab fa-youtube', 'YouTube'], ['youtu.be', 'fab fa-youtube', 'YouTube'],
  ['facebook.com', 'fab fa-facebook', 'Facebook'], ['x.com', 'fab fa-x-twitter', 'X'], ['twitter.com', 'fab fa-x-twitter', 'X'],
  ['twitch.tv', 'fab fa-twitch', 'Twitch'], ['spotify.com', 'fab fa-spotify', 'Spotify'], ['soundcloud.com', 'fab fa-soundcloud', 'SoundCloud'],
  ['music.apple.com', 'fab fa-apple', 'Apple Music'], ['deezer.com', 'si:deezer', 'Deezer'], ['bilibili.com', 'fab fa-bilibili', 'Bilibili'],
  ['xiaohongshu.com', 'si:xiaohongshu', 'Xiaohongshu'], ['linkedin.com', 'fab fa-linkedin', 'LinkedIn'], ['threads.net', 'fab fa-threads', 'Threads'],
  ['bsky.app', 'si:bluesky', 'Bluesky'], ['discord.gg', 'fab fa-discord', 'Discord'], ['discord.com', 'fab fa-discord', 'Discord'],
  ['pinterest.com', 'fab fa-pinterest', 'Pinterest'], ['pinterest.fr', 'fab fa-pinterest', 'Pinterest'], ['behance.net', 'fab fa-behance', 'Behance'],
];
function platformOf(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^(www|m)\./, ''); } catch {}
  const p = PLATFORMS.find(([d]) => host === d || host.endsWith('.' + d));
  return p ? { icon: p[1], label: p[2] } : { icon: 'fas fa-link', label: host || 'Lien' };
}

function buildMember(b, old) {
  const now = new Date().toISOString();
  const roles = [...new Set((Array.isArray(b.roles) ? b.roles : []).map(r => str(r, 40)).filter(Boolean))].slice(0, 8);
  const socials = (Array.isArray(b.socials) ? b.socials : []).map(x => ({ url: httpsUrl(x?.url) })).filter(x => x.url).slice(0, 12);
  return {
    id: old?.id || newId(),
    name: upper(str(b.name, 60)),
    roles,
    description: str(b.description, 400),
    song: str(b.song, 120),
    songUrl: httpsUrl(b.songUrl),
    photo: media(b.photo),
    miniature: media(b.miniature),
    socials,
    published: old?.published || null,
    publishedAt: old?.publishedAt || null,
    dateAjout: old?.dateAjout || now,
    dateModification: now,
  };
}

function buildEvent(b, old) {
  const now = new Date().toISOString();
  const hour = v => (/^\d{2}:\d{2}$/.test(v) ? v : '');
  return {
    id: old?.id || newId(),
    titre: str(b.titre, 100),
    sousTitre: str(b.sousTitre, 100),
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : '',
    heureDebut: hour(b.heureDebut),
    heureFin: hour(b.heureFin),
    lieu: str(b.lieu, 100),
    adresse: str(b.adresse, 200),
    description: str(b.description, 1500),
    lien: httpsUrl(b.lien),
    affiche: media(b.affiche),
    miniature: media(b.miniature),
    published: old?.published || null,
    publishedAt: old?.publishedAt || null,
    dateAjout: old?.dateAjout || now,
    dateModification: now,
  };
}

const REQUIRED = {
  members: m => (!m.name || !m.photo) && 'Pour publier : nom et photo obligatoires.',
  events: e => (!e.titre || !e.date) && 'Pour publier : titre et date obligatoires.',
};

// ── Extrait musical (30 s, API publique Deezer, sans clé) ──────────────
const previewCache = new Map();
async function findPreview(song, songUrl) {
  const key = `${songUrl}|${song}`;
  const hit = previewCache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60e3) return hit.data; // les liens d'extrait expirent : cache court
  let track = null;
  const m = /deezer\.com\/(?:[a-z]{2}\/)?track\/(\d+)/.exec(songUrl || '');
  if (m) {
    const r = await fetch(`https://api.deezer.com/track/${m[1]}`);
    if (r.ok) { const j = await r.json(); if (!j.error) track = j; }
  }
  if (!track && song) {
    const r = await fetch(`https://api.deezer.com/search?limit=1&q=${encodeURIComponent(song.replace(/\s+[-–]\s+/, ' '))}`);
    if (r.ok) track = (await r.json()).data?.[0] || null;
  }
  const data = track?.preview ? { preview: track.preview, title: track.title, artist: track.artist?.name || '' } : null;
  if (previewCache.size > 500) previewCache.clear();
  previewCache.set(key, { at: Date.now(), data });
  return data;
}

// ── YouTube : flux RSS de la chaîne (aucune clé API nécessaire) ────────
const YT_HEADERS = { 'accept-language': 'fr-FR,fr;q=0.9', cookie: 'SOCS=CAI; CONSENT=YES+1', 'user-agent': 'Mozilla/5.0 (BLACKSNOW site)' };
const decodeXml = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function resolveChannelId() {
  if (process.env.YT_CHANNEL_ID) return process.env.YT_CHANNEL_ID;
  if (db.videos.channelId) return db.videos.channelId;
  const html = await (await fetch(`https://www.youtube.com/@${YT_HANDLE}`, { headers: YT_HEADERS })).text();
  const m = html.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/) || html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (!m) throw new Error('identifiant de chaîne introuvable (renseigne YT_CHANNEL_ID dans .env)');
  db.videos.channelId = m[1];
  console.log(`↳ Chaîne YouTube trouvée : ${m[1]} (tu peux le mettre dans YT_CHANNEL_ID)`);
  return m[1];
}

let refreshing = null;
function refreshVideos() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const channelId = await resolveChannelId();
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { headers: YT_HEADERS });
    if (!res.ok) throw new Error(`flux RSS : HTTP ${res.status}`);
    const xml = await res.text();
    const byId = new Map(db.videos.items.map(v => [v.id, v]));
    for (const entry of xml.split('<entry>').slice(1)) {
      const id = (entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
      if (!id) continue;
      byId.set(id, {
        id,
        title: decodeXml((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''),
        published: (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || null,
        short: /youtube\.com\/shorts\//.test(entry),
      });
    }
    // Vidéos anciennes sans titre (absentes du flux, limité aux 15 dernières) : titre via oEmbed
    for (const v of [...byId.values()].filter(v => !v.title).slice(0, 10)) {
      try {
        const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.id}&format=json`);
        if (r.ok) v.title = (await r.json()).title || '';
      } catch {}
    }
    const before = JSON.stringify(db.videos.items);
    db.videos.items = [...byId.values()].sort((a, b) => (b.published || '').localeCompare(a.published || ''));
    db.videos.updatedAt = new Date().toISOString();
    await save('videos');
    const changed = before !== JSON.stringify(db.videos.items);
    if (changed) scheduleDeploy();
    return changed;
  })().catch(err => { console.warn('⚠ Vidéos YouTube non mises à jour :', err.message); throw err; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

// ── Mini moteur de templates ───────────────────────────────────────────
// {{> partial}}  inclut views/partials/partial.html
// {{var}}        texte échappé       {{{var}}}  HTML brut
const viewCache = new Map();
function readView(rel) {
  if (!IS_PROD || !viewCache.has(rel)) viewCache.set(rel, fs.readFileSync(path.join(VIEWS_DIR, rel), 'utf8'));
  return viewCache.get(rel);
}
let assetV = null;
function assetVersion() {
  if (IS_PROD && assetV) return assetV;
  const h = crypto.createHash('md5');
  for (const d of ['css', 'js']) {
    for (const f of fs.readdirSync(path.join(PUBLIC_DIR, d))) h.update(f + fs.statSync(path.join(PUBLIC_DIR, d, f)).mtimeMs);
  }
  return (assetV = h.digest('hex').slice(0, 8));
}
const renderCtx = { apiBase: '' }; // '' = même serveur ; en build statique : ADMIN_URL
function render(page, vars) {
  const all = {
    v: assetVersion(),
    apiBase: renderCtx.apiBase,
    canonical: SITE_URL + (vars.path || '/'),
    ogImage: `${SITE_URL}/images/groupe.png`,
    year: new Date().getFullYear(),
    ...vars,
  };
  return readView(`pages/${page}.html`)
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, p) => readView(`partials/${p}.html`))
    .replace(/\{\{\{\s*(\w+)\s*\}\}\}|\{\{\s*(\w+)\s*\}\}/g, (_, raw, safe) => raw ? (all[raw] ?? '') : esc(all[safe] ?? ''));
}

const SOCIAL_LINKS = [
  'https://www.instagram.com/blacksnow_dancecrew/',
  'https://www.youtube.com/@blacksnow_dancecrew',
  'https://www.tiktok.com/@blacksnow_dancecrew',
  'https://www.facebook.com/people/Black-Snow/100039859277194/',
];

// ── Rendu des pages ────────────────────────────────────────────────────
const publishedMembers = () => db.members.filter(m => m.published).map(m => ({ id: m.id, ...m.published }));
const publishedEvents = () => db.events.filter(e => e.published).map(e => ({ id: e.id, ...e.published }));
const MAX_VIDEOS = 6;
const visibleVideos = () => db.videos.items.filter(v => !v.short && !db.settings.hiddenVideos.includes(v.id)).slice(0, MAX_VIDEOS);

function iconHtml(icon) {
  return icon.startsWith('si:')
    ? `<img src="https://api.iconify.design/simple-icons/${icon.slice(3)}.svg?color=white" alt="" class="w-5 h-5">`
    : `<i class="${icon}" aria-hidden="true"></i>`;
}
function socialIcon(url, name) {
  const p = platformOf(url);
  return `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(name)} sur ${esc(p.label)}" title="${esc(p.label)}" class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition duration-300 hover:border-neon-blue">${iconHtml(p.icon)}</a>`;
}

const pages = {
  index() {
    const org = {
      '@context': 'https://schema.org', '@type': 'DanceGroup', name: 'BLACKSNOW',
      alternateName: 'BLACKSNOW Dance Crew', url: SITE_URL, logo: `${SITE_URL}/logo.svg`,
      image: `${SITE_URL}/images/groupe.png`, foundingDate: '2016', email: 'blacksnowdance@gmail.com',
      description: 'Crew de danse K-Pop lillois : covers de chorégraphies K-Pop, performances sur scène, conventions et festivals.',
      address: { '@type': 'PostalAddress', addressLocality: 'Lille', addressCountry: 'FR' },
      sameAs: SOCIAL_LINKS,
    };
    return render('index', {
      path: '/',
      title: 'BLACKSNOW ❅ Crew de danse K-Pop à Lille',
      description: 'BLACKSNOW, crew de danse K-Pop basé à Lille depuis 2016 : covers, performances, conventions et festivals. Découvrez nos vidéos et nos prochains événements.',
      heroJson: jsonForScript(db.settings.hero),
      jsonLd: jsonForScript(org),
    });
  },

  membres() {
    const members = publishedMembers();
    const ids = new Set(members.map(m => m.id));
    const gallery = {};
    for (const m of members) gallery[m.id] = { name: m.name, avatar: `/${m.miniature || m.photo}`, roles: m.roles || [], photos: [] };
    for (const p of sortedGallery()) {
      for (const id of p.members) if (ids.has(id)) gallery[id].photos.push({ u: `/${p.url}`, m: `/${p.miniature}`, l: p.legende || '', w: p.w || 0, h: p.h || 0 });
    }
    const cards = members.map(m => {
      const n = gallery[m.id].photos.length;
      const socials = (m.socials || []).map(x => socialIcon(x.url, m.name)).join('');
      const roles = (m.roles || []).map(r => `<span class="role-chip">${esc(r)}</span>`).join('');
      const songLink = m.songUrl ? platformOf(m.songUrl) : null;
      return `
      <article class="member-card y2k-card rounded-lg overflow-hidden border-2 transition duration-300 cursor-pointer" data-member="${esc(m.id)}">
        <div class="relative overflow-hidden h-80">
          <img src="/${esc(m.miniature || m.photo)}" alt="${esc(m.name)}, ${esc((m.roles || []).join(', ') || 'membre')} de BLACKSNOW" width="600" height="800" loading="lazy" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
          <div class="absolute bottom-0 left-0 p-6">
            <h2 class="text-3xl font-bold">${esc(m.name)}</h2>
            <div class="role-chips">${roles}</div>
          </div>
        </div>
        <div class="p-6">
          ${m.song ? `<div class="song-row mb-4">
            <button type="button" class="song-play" data-preview="${esc(m.id)}" aria-label="Écouter un extrait de ${esc(m.song)}"><span class="material-icons" aria-hidden="true">play_arrow</span></button>
            <span class="text-gray-300">${esc(m.song)}</span>
            ${songLink ? `<a href="${esc(m.songUrl)}" target="_blank" rel="noopener" class="song-link" title="Écouter sur ${esc(songLink.label)}" aria-label="Écouter sur ${esc(songLink.label)}">${iconHtml(songLink.icon)}</a>` : ''}
          </div>` : ''}
          ${m.description ? `<p class="text-gray-300 mb-4">${esc(m.description)}</p>` : ''}
          <div class="flex flex-wrap items-center gap-3">
            ${socials}
            ${n ? `<button type="button" class="member-gallery-btn ml-auto" data-member="${esc(m.id)}"><span class="material-icons" aria-hidden="true">photo_library</span> ${n} photo${n > 1 ? 's' : ''}</button>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
    return render('membres', {
      path: '/membres',
      title: 'Membres ❅ BLACKSNOW, crew de danse K-Pop à Lille',
      description: `Rencontrez les membres de BLACKSNOW : ${members.map(m => m.name.charAt(0) + m.name.slice(1).toLowerCase()).join(', ')}. Danseuses et chanteuses K-Pop à Lille.`,
      cards,
      galleryJson: jsonForScript(gallery),
    });
  },

  news() {
    const today = todayParis();
    const evs = publishedEvents().filter(e => e.date);
    const upcoming = evs.filter(e => e.date >= today).sort((a, b) => (a.date + a.heureDebut).localeCompare(b.date + b.heureDebut));
    const past = evs.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
    const hours = e => [frHour(e.heureDebut), frHour(e.heureFin)].filter(Boolean).join('-');
    const place = e => [e.lieu, e.adresse].filter(Boolean).join(', ');

    const upcomingHtml = upcoming.length ? upcoming.map(e => `
      <article class="bs-teaser">
        <span class="bs-deco tl" aria-hidden="true">❅</span><span class="bs-deco br" aria-hidden="true">❆</span>
        ${e.affiche ? `<img src="/${esc(e.affiche)}" alt="Affiche : ${esc(e.titre)}" loading="lazy" class="bs-poster">` : ''}
        ${place(e) ? `<div class="bs-tag">${esc(place(e))}</div>` : ''}
        <div class="bs-title"><time datetime="${esc(parisISO(e.date, e.heureDebut))}">${esc(frDate(e.date))}</time>${hours(e) ? ` | ${esc(hours(e))}` : ''}</div>
        <div class="bs-line"></div>
        <h2 class="bs-year">${esc(e.titre)}</h2>
        ${e.sousTitre ? `<div class="bs-title">${esc(e.sousTitre)}</div>` : ''}
        <div class="bs-line"></div>
        ${e.description ? `<p class="bs-desc">${esc(e.description)}</p>` : ''}
        <div class="bs-dots" aria-hidden="true"><div class="bs-dot"></div><div class="bs-dot"></div><div class="bs-dot"></div></div>
        ${e.lien ? `<a href="${esc(e.lien)}" target="_blank" rel="noopener" class="y2k-btn is-neon sm">Plus d'infos</a>` : `<div class="bs-sub">Plus d'infos sur nos réseaux</div>`}
      </article>`).join('') : `
      <div class="bs-teaser">
        <span class="bs-deco tl" aria-hidden="true">❅</span><span class="bs-deco br" aria-hidden="true">❆</span>
        <div class="bs-glitch">Quelque chose se prépare…</div>
        <div class="bs-sub">Suivez-nous sur nos réseaux pour ne rien rater</div>
      </div>`;

    const pastHtml = past.length ? `
      <h2 class="text-3xl md:text-4xl font-bold mt-24 mb-10 text-center y2k-font">Événements passés</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${past.map(e => `
        <article class="y2k-card rounded-lg overflow-hidden border-2">
          ${e.miniature ? `<img src="/${esc(e.miniature)}" alt="Affiche : ${esc(e.titre)}" loading="lazy" class="w-full h-48 object-cover">` : ''}
          <div class="p-5">
            <p class="text-neon-blue text-sm"><time datetime="${esc(e.date)}">${esc(frDate(e.date))}</time></p>
            <h3 class="text-xl font-bold mt-1">${esc([e.titre, e.sousTitre].filter(Boolean).join(' · '))}</h3>
            ${place(e) ? `<p class="text-gray-400 text-sm mt-1">${esc(place(e))}</p>` : ''}
          </div>
        </article>`).join('')}
      </div>` : '';

    const jsonLd = upcoming.map(e => ({
      '@context': 'https://schema.org', '@type': 'Event',
      name: [e.titre, e.sousTitre].filter(Boolean).join(' · ') + ' — BLACKSNOW',
      startDate: parisISO(e.date, e.heureDebut),
      ...(e.heureFin ? { endDate: parisISO(e.date, e.heureFin) } : {}),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: e.lieu || 'Lille', address: e.adresse || 'Lille, France' },
      image: e.affiche ? [`${SITE_URL}/${e.affiche}`] : [`${SITE_URL}/images/groupe.png`],
      description: e.description || `${e.titre}, par BLACKSNOW.`,
      organizer: { '@type': 'Organization', name: 'BLACKSNOW', url: SITE_URL },
      ...(e.lien ? { url: e.lien } : {}),
    }));

    return render('news', {
      path: '/news',
      title: 'Événements ❅ BLACKSNOW, danse K-Pop à Lille',
      description: upcoming.length
        ? `Prochain événement BLACKSNOW : ${upcoming[0].titre}${upcoming[0].sousTitre ? ' (' + upcoming[0].sousTitre + ')' : ''}, le ${frDate(upcoming[0].date)} à ${upcoming[0].lieu || 'Lille'}. Random dance, performances K-Pop et plus.`
        : 'Les prochains événements du crew BLACKSNOW à Lille : random dance, performances K-Pop, conventions et festivals.',
      upcoming: upcomingHtml,
      past: pastHtml,
      jsonLd: jsonForScript(jsonLd),
    });
  },

  videos() {
    const vids = visibleVideos();
    const recent = Date.now() - NEW_BADGE_DAYS * 864e5;
    const cards = vids.map(v => `
      <a href="https://www.youtube.com/watch?v=${esc(v.id)}" data-video="${esc(v.id)}" target="_blank" rel="noopener" class="video-card y2k-card group relative block rounded-lg overflow-hidden border-2 h-96">
        <img class="yt-thumb absolute inset-0" src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">
        <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
        <div class="absolute bottom-0 left-0 p-6">
          ${v.published && Date.parse(v.published) > recent ? '<span class="px-3 py-1 bg-neon-pink text-black text-xs font-bold rounded-full inline-block mb-2">NEW</span>' : ''}
          <h2 class="text-xl font-bold mb-1">${esc(v.title || 'Vidéo BLACKSNOW')}</h2>
          <p class="text-neon-blue text-sm">BLACKSNOW DANCE CREW</p>
        </div>
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition duration-300 bg-black bg-opacity-40">
          <div class="w-20 h-20 rounded-full border-2 flex items-center justify-center bg-black bg-opacity-60"><span class="material-icons text-5xl" aria-hidden="true">play_arrow</span></div>
        </div>
      </a>`).join('');
    const jsonLd = vids.filter(v => v.published).map(v => ({
      '@context': 'https://schema.org', '@type': 'VideoObject', name: v.title,
      description: `${v.title} — vidéo du crew de danse K-Pop BLACKSNOW (Lille).`,
      thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, uploadDate: v.published,
      embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`, contentUrl: `https://www.youtube.com/watch?v=${v.id}`,
    }));
    return render('videos', {
      path: '/videos',
      title: 'Vidéos ❅ BLACKSNOW, dance covers K-Pop à Lille',
      description: 'Les dance covers et performances filmées de BLACKSNOW, crew de danse K-Pop lillois. Toutes nos vidéos YouTube.',
      cards: cards || '<p class="text-center text-gray-400 col-span-full">Les vidéos arrivent bientôt.</p>',
      jsonLd: jsonForScript(jsonLd),
    });
  },

  contact() {
    return render('contact', {
      path: '/contact',
      title: 'Contact ❅ BLACKSNOW, crew de danse K-Pop à Lille',
      description: 'Contactez BLACKSNOW pour rejoindre le crew ou nous inviter à un événement (convention, festival, random dance) à Lille et alentours.',
    });
  },

  cgu() {
    return render('cgu', {
      path: '/cgu',
      title: 'Mentions légales ❅ BLACKSNOW',
      description: 'Mentions légales, conditions d\'utilisation et politique de confidentialité du site de BLACKSNOW.',
    });
  },
};

function robotsTxt() {
  return `User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}
function sitemapXml() {
  const last = list => list.map(x => x.publishedAt || '').sort().pop()?.slice(0, 10);
  const lastmod = { '/membres': last(db.members), '/news': last(db.events), '/videos': db.videos.updatedAt?.slice(0, 10) };
  const urls = Object.keys(ROUTES).map(r => `  <url><loc>${SITE_URL}${r === '/' ? '/' : r}</loc>${lastmod[r] ? `<lastmod>${lastmod[r]}</lastmod>` : ''}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
const page404 = p => render('404', { path: p, title: 'Page introuvable ❅ BLACKSNOW', description: 'Cette page n\'existe pas.' });
const ROUTES = { '/': 'index', '/membres': 'membres', '/news': 'news', '/videos': 'videos', '/contact': 'contact', '/cgu': 'cgu' };

// ── Publication : fabrique le site statique et l'envoie sur GitHub Pages ─
// Le site public est une copie figée des pages. Elle est régénérée et poussée
// sur la branche DEPLOY_BRANCH après chaque changement visible.
const { execFile } = require('child_process');
const DEPLOY_STATE_FILE = path.join(DATA_DIR, 'deploy.json');
const deploy = { state: 'idle', message: '', lastOkAt: null, lastDay: null, timer: null, running: false, again: false };
try { Object.assign(deploy, JSON.parse(fs.readFileSync(DEPLOY_STATE_FILE, 'utf8'))); deploy.state = 'idle'; } catch {}

function git(args) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (DEPLOY_SSH_KEY) env.GIT_SSH_COMMAND = `ssh -i ${DEPLOY_SSH_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
  return new Promise((resolve, reject) => execFile('git', args, { cwd: BUILD_DIR, env, maxBuffer: 10e6, timeout: 10 * 60e3 }, (err, stdout, stderr) => {
    if (!err) return resolve(stdout);
    const msg = (stderr || err.message).trim().split('\n').slice(-3).join(' ');
    reject(Object.assign(new Error(msg), { code: err.code }));
  }));
}

// Fichiers du dossier uploads/ visibles publiquement (rien des brouillons)
function publicUploads() {
  const set = new Set();
  const members = publishedMembers();
  const ids = new Set(members.map(m => m.id));
  for (const m of members) urlsOf(m).forEach(u => set.add(u));
  for (const e of publishedEvents()) urlsOf(e).forEach(u => set.add(u));
  for (const p of db.gallery) if (p.members.some(id => ids.has(id))) { set.add(p.url); set.add(p.miniature); }
  return set;
}

async function linkOrCopy(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try { await fsp.link(src, dest); } catch { await fsp.copyFile(src, dest); } // lien physique : pas de double stockage
}
async function copyDir(src, dest, skip = () => false) {
  for (const ent of await fsp.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name), d = path.join(dest, ent.name);
    if (skip(s)) continue;
    if (ent.isDirectory()) await copyDir(s, d, skip);
    else if (ent.isFile()) await linkOrCopy(s, d);
  }
}
const redirectPage = (to, title) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>${esc(title)}</title><meta http-equiv="refresh" content="0;url=${esc(to)}"><link rel="canonical" href="${esc(to)}"></head><body><a href="${esc(to)}">${esc(title)}</a></body></html>`;

async function buildSite() {
  await fsp.mkdir(BUILD_DIR, { recursive: true });
  for (const name of await fsp.readdir(BUILD_DIR)) if (name !== '.git') await fsp.rm(path.join(BUILD_DIR, name), { recursive: true, force: true });
  // 1. fichiers fixes (css, js, images, logo, favicon), sans les uploads
  await copyDir(PUBLIC_DIR, BUILD_DIR, s => path.resolve(s) === UPLOAD_DIR || path.basename(s).startsWith('.'));
  // 2. uploads publiés uniquement
  for (const u of publicUploads()) {
    const src = path.join(UPLOAD_DIR, path.basename(u));
    if (fs.existsSync(src)) await linkOrCopy(src, path.join(BUILD_DIR, 'uploads', path.basename(u)));
  }
  // 3. pages
  renderCtx.apiBase = ADMIN_URL;
  try {
    for (const [route, name] of Object.entries(ROUTES)) {
      await fsp.writeFile(path.join(BUILD_DIR, route === '/' ? 'index.html' : `${name}.html`), pages[name]());
    }
    await fsp.writeFile(path.join(BUILD_DIR, '404.html'), page404('/404'));
  } finally { renderCtx.apiBase = ''; }
  await fsp.writeFile(path.join(BUILD_DIR, 'robots.txt'), robotsTxt());
  await fsp.writeFile(path.join(BUILD_DIR, 'sitemap.xml'), sitemapXml());
  await fsp.writeFile(path.join(BUILD_DIR, 'galerie.html'), redirectPage('/membres', 'Membres BLACKSNOW'));
  if (ADMIN_URL) await fsp.writeFile(path.join(BUILD_DIR, 'admin.html'), redirectPage(`${ADMIN_URL}/admin`, 'Espace de gestion'));
  await fsp.writeFile(path.join(BUILD_DIR, '.nojekyll'), '');
  await fsp.writeFile(path.join(BUILD_DIR, 'CNAME'), new URL(SITE_URL).hostname + '\n');
}

async function pushSite() {
  if (!fs.existsSync(path.join(BUILD_DIR, '.git'))) {
    await git(['init', '-q']);
    await git(['checkout', '-q', '-b', DEPLOY_BRANCH]);
  }
  try { await git(['remote', 'set-url', 'origin', DEPLOY_REPO]); } catch { await git(['remote', 'add', 'origin', DEPLOY_REPO]); }
  await git(['add', '-A']);
  let changed = true;
  try { await git(['diff', '--cached', '--quiet']); changed = false; } catch {}
  if (changed) {
    await git(['-c', 'user.name=BLACKSNOW (admin du site)', '-c', 'user.email=blacksnowdance@gmail.com',
      'commit', '-q', '-m', `Mise à jour du site — ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`]);
  }
  // --force : ce dossier est la seule source de la branche publiée
  await git(['push', '-q', '--force', 'origin', `HEAD:${DEPLOY_BRANCH}`]);
  return changed;
}

async function runDeploy() {
  if (deploy.running) { deploy.again = true; return; }
  deploy.running = true; deploy.again = false;
  deploy.state = 'building'; deploy.message = 'Fabrication du site…';
  try {
    await buildSite();
    if (DEPLOY_REPO) {
      deploy.message = 'Envoi sur GitHub…';
      const changed = await pushSite();
      deploy.message = changed ? 'Envoyé : en ligne d\'ici 1 à 2 minutes.' : 'Déjà à jour.';
    } else {
      deploy.message = 'Site fabriqué dans _build/ (envoi désactivé : DEPLOY_REPO vide).';
    }
    deploy.state = 'ok'; deploy.lastOkAt = new Date().toISOString(); deploy.lastDay = todayParis();
    await fsp.writeFile(DEPLOY_STATE_FILE, JSON.stringify({ lastOkAt: deploy.lastOkAt, lastDay: deploy.lastDay }));
  } catch (err) {
    deploy.state = 'error'; deploy.message = err.message;
    console.error('✖ Publication du site :', err.message);
  } finally {
    deploy.running = false;
    if (deploy.again) scheduleDeploy(0);
  }
}
// Regroupe les changements rapprochés (ex. tag de plusieurs photos) en une seule publication
function scheduleDeploy(delay = 4000) {
  if (deploy.running) { deploy.again = true; return; }
  clearTimeout(deploy.timer);
  deploy.state = 'pending'; deploy.message = 'Mise en ligne dans quelques secondes…';
  deploy.timer = setTimeout(runDeploy, delay);
}
const deployStatus = () => ({ state: deploy.state, message: deploy.message, lastOkAt: deploy.lastOkAt, remote: !!DEPLOY_REPO, siteUrl: SITE_URL });

// ── Application Express ────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Redirections 301 : anciennes URLs .html et slash final
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const p = req.path;
  let target = null;
  if (p === '/index.html' || p === '/index') target = '/';
  else if (/^\/(membres|news|videos|contact|cgu|admin)\.html$/.test(p)) target = p.slice(0, -5);
  else if (p.length > 1 && p.endsWith('/')) target = p.replace(/\/+$/, '');
  if (!target) return next();
  const q = req.originalUrl.indexOf('?');
  res.redirect(301, target + (q >= 0 ? req.originalUrl.slice(q) : ''));
});

// Fichiers statiques
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true, index: false }));
app.use(express.static(PUBLIC_DIR, {
  index: false,
  setHeaders: (res, file, stat) => res.set('Cache-Control', /\.(css|js)$/.test(file) ? 'public, max-age=31536000, immutable' : (IS_PROD ? 'public, max-age=604800' : 'no-cache')),
}));

// Aperçu du site public sur ce serveur (le vrai site public est la copie sur GitHub Pages)
const SITE_HOST = new URL(SITE_URL).hostname;
app.use((req, res, next) => { if (req.hostname !== SITE_HOST) res.set('X-Robots-Tag', 'noindex'); next(); });
for (const [route, page] of Object.entries(ROUTES)) {
  app.get(route, (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.type('html').send(pages[page]());
  });
}

app.get('/robots.txt', (req, res) => res.type('text/plain').send(robotsTxt()));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(sitemapXml()));

// Admin
app.get('/admin', (req, res) => {
  res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' });
  res.sendFile(path.join(VIEWS_DIR, 'admin.html'));
});

// ── API : authentification ─────────────────────────────────────────────
const json = express.json({ limit: '200kb' });

app.post('/api/auth/login', json, (req, res) => {
  const ip = req.ip;
  const f = failures.get(ip);
  if (f?.until > Date.now()) {
    return res.status(429).json({ error: `Trop d'essais. Réessaie dans ${Math.ceil((f.until - Date.now()) / 60000)} min.` });
  }
  if (!checkPassword(req.body?.password)) {
    const rec = f && !f.until ? f : { count: 0, until: 0 };
    rec.count++;
    if (rec.count >= 5) rec.until = Date.now() + 15 * 60e3;
    failures.set(ip, rec);
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  failures.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { exp: Date.now() + SESSION_MS });
  res.json({ token });
});
app.post('/api/auth/logout', (req, res) => {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.get('authorization') || '');
  if (m) sessions.delete(m[1]);
  res.json({ ok: true });
});
app.get('/api/auth/check', requireAuth, (req, res) => res.json({ ok: true }));

// ── API admin : upload d'une image (photo de membre, affiche) ──────────
app.post('/api/admin/upload', requireAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw httpError(400, 'Aucun fichier reçu.');
  const { url, miniature } = await processImage(req.file);
  res.json({ url, miniature });
}));

// ── API admin : membres & événements (CRUD) ────────────────────────────
for (const [name, build] of [['members', buildMember], ['events', buildEvent]]) {
  const base = `/api/admin/${name}`;
  const find = id => { const i = db[name].findIndex(x => x.id === id); if (i < 0) throw httpError(404, 'Élément introuvable (supprimé ailleurs ?).'); return i; };
  app.get(base, requireAuth, noStore, (req, res) => res.json(db[name].map(x => decorate(name, x))));

  app.post(base, requireAuth, json, wrap(async (req, res) => {
    const item = build(req.body || {});
    db[name].push(item);
    await save(name);
    res.status(201).json(decorate(name, item));
  }));

  // Publier : la version de travail devient visible sur le site
  app.post(`${base}/:id/publish`, requireAuth, wrap(async (req, res) => {
    const item = db[name][find(req.params.id)];
    const problem = REQUIRED[name](item);
    if (problem) throw httpError(400, problem);
    const oldPublished = item.published;
    item.published = snapshot(item, FIELDS[name]);
    item.publishedAt = new Date().toISOString();
    await save(name);
    await deleteIfOrphan(urlsOf(oldPublished));
    scheduleDeploy();
    res.json(decorate(name, item));
  }));
  // Retirer du site (repasse en brouillon, rien n'est supprimé)
  app.post(`${base}/:id/unpublish`, requireAuth, wrap(async (req, res) => {
    const item = db[name][find(req.params.id)];
    const old = item.published;
    item.published = null; item.publishedAt = null;
    await save(name);
    await deleteIfOrphan(urlsOf(old));
    scheduleDeploy();
    res.json(decorate(name, item));
  }));
  // Annuler les modifications non publiées
  app.post(`${base}/:id/revert`, requireAuth, wrap(async (req, res) => {
    const item = db[name][find(req.params.id)];
    if (!item.published) throw httpError(400, 'Rien à annuler : jamais publié.');
    const old = snapshot(item, FIELDS[name]);
    Object.assign(item, snapshot(item.published, FIELDS[name]), { dateModification: new Date().toISOString() });
    await save(name);
    await deleteIfOrphan(urlsOf(old));
    res.json(decorate(name, item));
  }));

  app.put(`${base}/:id`, requireAuth, json, wrap(async (req, res) => {
    const i = find(req.params.id);
    const old = db[name][i];
    db[name][i] = build(req.body || {}, old);
    await save(name);
    await deleteIfOrphan(urlsOf(old));
    res.json(decorate(name, db[name][i]));
  }));

  app.delete(`${base}/:id`, requireAuth, wrap(async (req, res) => {
    const i = db[name].findIndex(x => x.id === req.params.id);
    if (i < 0) throw httpError(404, 'Élément introuvable.');
    const [old] = db[name].splice(i, 1);
    await save(name);
    if (old.published) scheduleDeploy();
    if (name === 'members') { // retirer ce membre des photos de la galerie
      for (const p of db.gallery) p.members = p.members.filter(id => id !== old.id);
      await save('gallery');
    }
    await deleteIfOrphan(urlsOf(old));
    res.json({ ok: true });
  }));
}

app.put('/api/admin/members-order', requireAuth, json, wrap(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const rank = new Map(ids.map((id, i) => [id, i]));
  db.members.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  await save('members');
  scheduleDeploy();
  res.json({ ok: true });
}));

// ── Extrait musical ────────────────────────────────────────────────────
app.get('/api/preview/:id', wrap(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*'); // appelé depuis le site public (autre domaine)
  const m = publishedMembers().find(x => x.id === req.params.id);
  if (!m?.song) throw httpError(404, 'Pas de chanson.');
  let data = null;
  try { data = await findPreview(m.song, m.songUrl); } catch {}
  if (!data) throw httpError(404, 'Extrait introuvable.');
  res.set({ 'Cache-Control': 'public, max-age=600', 'Access-Control-Allow-Origin': '*' }).json(data);
}));
app.post('/api/admin/preview', requireAuth, json, wrap(async (req, res) => {
  let data = null;
  try { data = await findPreview(str(req.body?.song, 120), httpsUrl(req.body?.songUrl)); }
  catch { throw httpError(502, 'Impossible de joindre Deezer.'); }
  res.json(data || { preview: null });
}));

// ── API admin : galerie photos ─────────────────────────────────────────
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const photoKey = p => (p.date || p.dateAjout.slice(0, 10)) + p.dateAjout;
const sortedGallery = () => [...db.gallery].sort((a, b) => photoKey(b).localeCompare(photoKey(a)));
const validMembers = list => {
  const ids = new Set(db.members.map(m => m.id));
  return [...new Set((Array.isArray(list) ? list : []).filter(id => ids.has(id)))];
};

app.get('/api/admin/gallery', requireAuth, noStore, (req, res) => res.json(sortedGallery()));

app.post('/api/admin/gallery', requireAuth, upload.array('files', 60), wrap(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw httpError(400, 'Aucune photo reçue.');
  let members = [], dates = [];
  try { members = validMembers(JSON.parse(req.body.members || '[]')); } catch {}
  try { dates = JSON.parse(req.body.dates || '[]'); } catch {}
  const created = [];
  try {
    for (const [i, f] of files.entries()) {
      const { exifDate, ...img } = await processImage(f);
      const date = exifDate || (isDay(dates[i]) ? dates[i] : '');
      created.push({ id: newId(), ...img, members, legende: str(req.body.legende, 200), date, dateAjout: new Date().toISOString() });
    }
  } catch (err) {
    await discardFiles(files);
    for (const c of created) await deleteIfOrphan([c.url, c.miniature]);
    throw err;
  }
  db.gallery.push(...created);
  await save('gallery');
  if (members.length) scheduleDeploy();
  res.status(201).json(created);
}));

app.put('/api/admin/gallery/:id', requireAuth, json, wrap(async (req, res) => {
  const p = db.gallery.find(x => x.id === req.params.id);
  if (!p) throw httpError(404, 'Photo introuvable.');
  if ('members' in req.body) p.members = validMembers(req.body.members);
  if ('legende' in req.body) p.legende = str(req.body.legende, 200);
  if ('date' in req.body) p.date = isDay(req.body.date) ? req.body.date : '';
  await save('gallery');
  scheduleDeploy();
  res.json(p);
}));

app.delete('/api/admin/gallery/:id', requireAuth, wrap(async (req, res) => {
  const i = db.gallery.findIndex(x => x.id === req.params.id);
  if (i < 0) throw httpError(404, 'Photo introuvable.');
  const [old] = db.gallery.splice(i, 1);
  await save('gallery');
  scheduleDeploy();
  await deleteIfOrphan(urlsOf(old));
  res.json({ ok: true });
}));

// ── API admin : vidéos & vidéo d'accueil ───────────────────────────────
app.get('/api/admin/settings', requireAuth, noStore, (req, res) => res.json(db.settings));

app.put('/api/admin/settings', requireAuth, json, wrap(async (req, res) => {
  const b = req.body || {};
  if (b.hero) {
    const id = String(b.hero.videoId || '');
    if (!/^[\w-]{11}$/.test(id)) throw httpError(400, 'Identifiant de vidéo YouTube invalide.');
    const start = Math.max(0, Math.floor(Number(b.hero.start) || 0));
    const end = Math.max(0, Math.floor(Number(b.hero.end) || 0));
    if (end && end <= start) throw httpError(400, 'La fin doit être après le début (ou 0 = jusqu\'à la fin).');
    db.settings.hero = { videoId: id, start, end };
  }
  if (Array.isArray(b.hiddenVideos)) db.settings.hiddenVideos = b.hiddenVideos.filter(id => /^[\w-]{11}$/.test(id));
  await save('settings');
  scheduleDeploy();
  res.json(db.settings);
}));

app.get('/api/admin/videos', requireAuth, noStore, (req, res) => res.json(db.videos));
app.post('/api/admin/videos/refresh', requireAuth, wrap(async (req, res) => {
  try { await refreshVideos(); } catch (err) { throw httpError(502, `Impossible de joindre YouTube : ${err.message}`); }
  res.json(db.videos);
}));

// ── Publication : statut, republier, tâche planifiée ──────────────────
app.get('/api/admin/deploy', requireAuth, noStore, (req, res) => res.json(deployStatus()));
app.post('/api/admin/deploy', requireAuth, (req, res) => { scheduleDeploy(0); res.json(deployStatus()); });

// À appeler toutes les heures (tâche planifiée Alwaysdata) : vidéos YouTube + passage des événements en « passés »
app.get('/api/cron', wrap(async (req, res) => {
  const ok = CRON_TOKEN.length >= 16 && typeof req.query.token === 'string' && req.query.token.length === CRON_TOKEN.length
    && crypto.timingSafeEqual(Buffer.from(req.query.token), Buffer.from(CRON_TOKEN));
  if (!ok) throw httpError(403, 'Jeton invalide.');
  let videos = 'inchangées';
  try { videos = (await refreshVideos()) ? 'mises à jour' : 'inchangées'; } catch (err) { videos = `erreur (${err.message})`; }
  if (deploy.lastDay !== todayParis() && deploy.state !== 'pending' && !deploy.running) scheduleDeploy(0);
  res.set('Cache-Control', 'no-store').json({ ok: true, videos, deploy: deploy.state });
}));

// ── 404 et erreurs ─────────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue.' }));
app.use((req, res) => res.status(404).type('html').send(page404(req.path)));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = { LIMIT_FILE_SIZE: 'Fichier trop lourd (30 Mo max).', LIMIT_FILE_COUNT: 'Trop de fichiers d\'un coup (60 max).' }[err.code] || 'Erreur pendant l\'envoi.';
    return res.status(400).json({ error: msg });
  }
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? 'Erreur serveur.' : err.message });
});

// ── Démarrage ──────────────────────────────────────────────────────────
loadData();
sweepUploads().catch(() => {});
setInterval(() => sweepUploads().catch(() => {}), 6 * 3600e3).unref();
refreshVideos().catch(() => {});
setInterval(() => refreshVideos().catch(() => {}), 3600e3).unref();
// Une publication par jour au minimum (événements passés), et au démarrage si besoin
setInterval(() => { if (deploy.lastDay !== todayParis() && deploy.state !== 'pending' && !deploy.running) scheduleDeploy(0); }, 15 * 60e3).unref();
if (deploy.lastDay !== todayParis()) scheduleDeploy(5000);
if (DEPLOY_REPO && !ADMIN_URL) console.warn('⚠ ADMIN_URL vide : le lecteur d\'extraits ne marchera pas sur le site public.');

app.listen(PORT, () => {
  console.log(`✔ Site : http://localhost:${PORT}   |   Admin : http://localhost:${PORT}/admin`);
});
