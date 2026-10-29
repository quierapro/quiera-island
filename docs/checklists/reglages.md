# Réglages et optimisation, vérifications

## Réglages

Une fenêtre « Réglages de Quiera », ouverte depuis l'icône de la barre des tâches (« Réglages… ») ou le lanceur (`réglages`, `paramètres`). Chaque changement est enregistré et appliqué tout de suite, sans redémarrer.

| Section | Réglages |
|---|---|
| Général | Lancer au démarrage de Windows · Écran · Ouvrir au survol (sinon au clic) · Se cacher en plein écran · Animations (système, réduites, complètes) |
| Lanceur | Activé · Raccourci (Alt+Espace, Ctrl+Alt+Espace, Ctrl+Maj+Espace, Alt+Q ; prévient si pris, et dit lequel est utilisé) · Rechercher dans les fichiers |
| Musique | Paroles · Mot à mot via NetEase (**désactivé par défaut** : API non officielle) · Décalage des paroles (±2 s) |
| Notifications | Dans l'île · Les annoncer |
| Presse-papiers et Shelf | Historique · Garder le Shelf entre deux sessions |
| Aperçus | Chargeur · Casque · Verr. Maj · Volume |

**Fichier** : `settings.json` dans le dossier de configuration de l'appli (`%APPDATA%\app.quiera`). Chaque champ a une valeur par défaut : un fichier ancien ou incomplet se charge ; un fichier illisible est mis de côté (`settings.unreadable.json`), pas perdu. Écriture par fichier temporaire puis remplacement : un arrêt en pleine écriture ne laisse jamais un fichier à moitié écrit.

**Ce que couper un module fait** : le lanceur rend son raccourci ; « Rechercher dans les fichiers » libère l'index (~35 Mo) ; l'historique du presse-papiers et les notifications sont vidés ; le Shelf gardé est enregistré (ses chemins dans `shelf.json`) ou son fichier supprimé.

**Démarrage avec Windows** : la clé `Run` de l'utilisateur (visible et désactivable dans le Gestionnaire des tâches › Applications de démarrage) ; réécrite à chaque lancement pour suivre l'emplacement de l'appli.

## Optimisation

- **Mémoire de WebView2** : 4 s après la fermeture de l'île, Quiera demande à WebView2 un niveau de mémoire bas ; retour au niveau normal dès qu'elle s'ouvre (ou que le lanceur s'ouvre).
- **Index des fichiers** en priorité d'arrière-plan (processeur et disque) : il laisse passer tout le reste.
- **Modules coupés** : ne tournent plus (pas d'index, pas de raccourci).
- **Version finale** : sans le panneau de développement ni sa CSS ; la fenêtre de réglages est une page à part, chargée seulement à l'ouverture. Profil Rust optimisé (LTO, une unité de compilation, symboles retirés).

## Mesuré le 29/10/2026 (version optimisée, écran 180 Hz)

| Point | Résultat |
|---|---|
| `quiera.exe` | 7,4 Mo ; prêt en ~2 s (île placée, tous les modules démarrés) |
| Mémoire au repos | `quiera.exe` 62 Mo (dont l'index des fichiers), WebView2 ~185 Mo privés |
| Mode mémoire basse de WebView2 | −18 Mo de mémoire en service (174 → 156 Mo) ; sans effet sur la mémoire privée |
| Processeur, musique en cours dans la pilule | Avant : GPU 311 + rendu 184 ms/s. Cause : les barres ♪ animées à chaque image et l'horloge des paroles à 180 Hz. Après (barres en 5 positions, horloge à 30 Hz) : GPU ~78 + rendu ~70 ms/s |
| Processeur, île cachée (jeu en plein écran) | ~6 ms/s |
| `quiera.exe` hors indexation | ~2 ms/s |
| Index des fichiers | 509 000 entrées en 35 à 54 s, en arrière-plan |

Vérifié dans la vraie fenêtre : changer le raccourci (Alt+Q pris aussitôt, retour sur Alt+Espace → Ctrl+Alt+Espace car Alt+Espace est pris par une autre appli) ; démarrage avec Windows (entrée `QuieraIsland` créée avec le bon chemin, puis retirée ; une entrée « Quiera » d'un autre programme laissée intacte) ; `settings.json` écrit.

**Corrigé en route** : l'entrée de démarrage s'appelait « Quiera », comme celle d'un autre programme déjà présent : l'activer puis la couper l'aurait supprimée. Elle s'appelle désormais `QuieraIsland`. Et la fenêtre ouverte depuis le lanceur restait blanche (fenêtre créée depuis une commande synchrone) : la commande est devenue asynchrone.

## Automatique

- `cargo test` : réglages par défaut, aller-retour, fichier ancien complété, fichier illisible mis de côté, valeurs bornées, format lisible.
- `pnpm test` : décalage des paroles, mot « réglages » dans le lanceur.

## Manuel

- [ ] Icône de la barre des tâches › « Réglages… » : la fenêtre s'ouvre (une seule, même en cliquant deux fois).
- [ ] `réglages` dans le lanceur l'ouvre aussi.
- [ ] « Lancer au démarrage » puis redémarrer la session : Quiera est là.
- [ ] « Ouvrir au survol » coupé : l'île grossit au survol, s'ouvre au clic.
- [ ] « Se cacher en plein écran » coupé : l'île reste pendant une vidéo plein écran.
- [ ] Changer le raccourci : le nouveau ouvre le lanceur, l'ancien non ; un raccourci pris est signalé.
- [ ] « Paroles mot à mot » activé : les paroles NetEase reviennent (chanson suivante).
- [ ] Décalage +0,5 s : les paroles arrivent un peu plus tard.
- [ ] « Garder le Shelf » : fermer et rouvrir Quiera, les fichiers sont toujours là.
- [ ] Couper un aperçu (Verr. Maj) : il ne s'affiche plus.
- [ ] Fermer Quiera, rouvrir : tous les réglages sont restés.
