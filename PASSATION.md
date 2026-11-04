# Site BLACKSNOW : passation

Ce document est fait pour que n'importe quel membre du bureau puisse reprendre le site, même sans savoir coder.

## Au quotidien : rien de technique
- **Modifier le site** : aller sur **https://blacksnowdancecrew.fr/admin** (on est redirigé vers la vraie adresse de l'admin) et entrer le **mot de passe admin**.
- **Publier** : chaque modification reste en brouillon jusqu'au clic sur « Publier ». Le site public est mis à jour en 1 à 2 minutes. La pastille en haut de l'admin indique l'état : « Site à jour », « Mise en ligne… » ou « Erreur ».
- **Vidéos et événements** : les vidéos YouTube et le passage des événements en « passés » se mettent à jour tout seuls.

## Les comptes (tous rattachés à blacksnowdance@gmail.com)
| Service | Rôle | Où sont les accès |
|---|---|---|
| Gmail `blacksnowdance@gmail.com` | Récupérer tous les autres mots de passe | Bureau de l'asso |
| **GitHub** | Héberge le code et le site public (GitHub Pages, gratuit) | Compte de l'asso |
| **Alwaysdata** | Fait tourner l'admin et garde les données (offre gratuite) | Compte de l'asso |
| **OVH** | Le nom de domaine `blacksnowdancecrew.fr` (à renouveler chaque année, voir la date d'expiration chez OVH) | Compte de l'asso |
| Mot de passe admin du site | Variable `ADMIN_PASSWORD` dans Alwaysdata (*Web > Sites > modifier*) | Bureau de l'asso |

👉 Garder ces accès dans un endroit partagé par le bureau (gestionnaire de mots de passe, document privé), **pas sur le PC d'une seule personne**.

## Comment ça marche
```
  Admin (Alwaysdata)  ── « Publier » ──▶  fabrique les pages  ──▶  GitHub (branche gh-pages)  ──▶  blacksnowdancecrew.fr
  data/ + photos                                                    GitHub Pages
```
- **Alwaysdata** : `https://blacksnow.alwaysdata.net` fait tourner le serveur (`server.js`). Il garde les données (`data/`) et les photos (`public/uploads/`).
- **GitHub** : à chaque changement, le serveur fabrique une copie figée du site et l'envoie sur la branche `gh-pages` du repo. GitHub Pages l'affiche ensuite sur le domaine.
- **Tâche planifiée** : une tâche Alwaysdata appelle `/api/cron?token=…` toutes les heures pour synchroniser les vidéos et faire la mise à jour quotidienne.

## Si quelque chose ne marche plus
| Problème | Quoi faire |
|---|---|
| La pastille affiche « Erreur » | La survoler pour lire le message, puis cliquer dessus pour réessayer. Si c'est un problème d'accès GitHub (« Permission denied »), vérifier la clé de déploiement (voir plus bas). |
| L'admin ne répond plus | Alwaysdata : *Web > Sites*, redémarrer le site. Journaux : `ls ~/admin/logs` en SSH. |
| Le site public n'est plus à jour | GitHub : *Settings > Pages* doit afficher la source « Deploy from a branch », `gh-pages` / root, avec le domaine `blacksnowdancecrew.fr`. |
| Le domaine ne marche plus | Vérifier chez OVH que le domaine n'a pas expiré et que la zone DNS pointe vers GitHub Pages (4 lignes A `185.199.108-111.153`, CNAME `www` vers `<compte>.github.io.`). |
| Mot de passe admin oublié | Alwaysdata : *Web > Sites > modifier*, changer `ADMIN_PASSWORD`, puis redémarrer. |

## Réglages du site sur Alwaysdata (*Web > Sites > modifier*)
- **Type** : Node.js · **Commande** : `node server.js` · **Répertoire** : `/home/<login>/blacksnow/` · **Node.js** : `22`
- **Environnement** (une seule ligne) :
```
ADMIN_PASSWORD=… NODE_ENV=production TRUST_PROXY=1 SITE_URL=https://blacksnowdancecrew.fr ADMIN_URL=https://blacksnow.alwaysdata.net DEPLOY_REPO=git@github.com:<compte>/<repo>.git CRON_TOKEN=…
```
- **Tâche planifiée** (*Avancé > Tâches planifiées*, type URL, toutes les heures) : `https://blacksnow.alwaysdata.net/api/cron?token=<CRON_TOKEN>`

## Clé de déploiement GitHub
Le serveur se connecte à GitHub avec une clé SSH (`~/.ssh/id_ed25519` sur Alwaysdata). Sa partie publique est enregistrée dans le repo : *Settings > Deploy keys*, avec **« Allow write access » coché**. Si elle disparaît :
1. En SSH sur Alwaysdata, lancer `cat ~/.ssh/id_ed25519.pub` (ou en créer une avec `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""`).
2. La coller dans *Deploy keys*, cocher « Allow write access », puis enregistrer.

## Modifier le code (pour une personne qui code)
- **En local** : `npm install`, copier `.env.example` en `.env`, puis `npm run dev`. Sans `DEPLOY_REPO`, le site est fabriqué dans `_build/` sans être envoyé.
- **Mettre en production** : pousser sur `main`, puis en SSH sur Alwaysdata `cd ~/blacksnow && git pull && npm install --omit=dev`, et redémarrer le site.
- **Sauvegardes** : le site public publié est entièrement sur GitHub. Les **brouillons** et les photos non taguées ne sont que sur Alwaysdata (sauvegarde 3 jours). Récupérer de temps en temps `data/` et `public/uploads/` par SFTP.
- **Espace disque** : 1 Go sur l'offre gratuite d'Alwaysdata. Surveiller l'espace utilisé si la galerie grossit beaucoup (chaque photo est stockée environ 2 fois).
