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

## Mise en ligne (ex. Alwaysdata)
1. Créer un site de type **Node.js**, commande : `node server.js`, répertoire : le dossier du projet.
2. Envoyer les fichiers (Git ou SFTP), puis en SSH : `npm install --omit=dev`.
3. Variables d'environnement (dans l'interface) : `ADMIN_PASSWORD`, `SITE_URL=https://blacksnowdancecrew.fr`, `NODE_ENV=production`, `TRUST_PROXY=1`.
4. DNS OVH : pointer `blacksnowdancecrew.fr` vers l'hébergeur (et retirer GitHub Pages).
5. Google Search Console : ajouter le site et soumettre `https://blacksnowdancecrew.fr/sitemap.xml`.

⚠ Ne jamais commiter `.env`, `data/` ni `public/uploads/` (déjà dans `.gitignore`). Sauvegarder ces deux dossiers de temps en temps : ce sont les contenus du site.
