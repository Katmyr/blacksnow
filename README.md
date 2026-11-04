# BLACKSNOW — site + admin

## Structure
```
server.js          serveur (pages, admin, API, YouTube)
views/pages/       pages du site (HTML avec {{variables}})
views/partials/    head, menu, footer → à modifier UNE seule fois pour tout le site
views/admin.html   page /admin
public/            fichiers servis tels quels (css, js, images, logo.svg, favicon.ico)
public/uploads/    images envoyées depuis l'admin (compressées en WebP)
data/              base de données JSON (créée au 1er lancement depuis data-seed/)
```

## À copier depuis l'ancien site
`logo.svg` et `favicon.ico` → `public/` · dossier `images/` → `public/images/`

## Tester en local (PowerShell)
```powershell
npm install
Copy-Item .env.example .env   # puis éditer ADMIN_PASSWORD (12 caractères min)
npm start
```
Site : http://localhost:3000 · Admin : http://localhost:3000/admin

## Mettre à jour au quotidien
Tout se fait dans `/admin`. Les modifications de membres et d'événements sont enregistrées automatiquement **en brouillon** et n'apparaissent sur le site qu'après un clic sur « Publier ». Contenu : membres (glisser pour l'ordre), photos de la galerie (taguer les membres présents), événements (passent seuls en « passés »), vidéo d'accueil + timecodes. La page Vidéos se synchronise seule avec la chaîne YouTube toutes les heures (bouton « Actualiser » sinon). Shorts masqués automatiquement.

## Mise en ligne
Le site public est fabriqué par le serveur et envoyé sur GitHub Pages à chaque publication. L'admin tourne sur Alwaysdata (offre gratuite). Tout est expliqué dans **PASSATION.md**.

⚠ Ne jamais commiter `.env`, `data/`, `public/uploads/` ni `_build/` (déjà dans `.gitignore`).
