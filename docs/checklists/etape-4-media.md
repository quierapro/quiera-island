# Étape 4 : module média, vérifications

## Automatique

- `cargo test` : modèle d'état, cache des pochettes, conversion des temps Windows, position et durée.
- `pnpm test` : position extrapolée, formats de temps, règle « activité / aperçu », couleur d'accent.

## Vérifié le 28/10/2026 (mode développement, WebView2 inspectée de l'intérieur)

| Point | Résultat |
|---|---|
| Lecture des sessions Windows (SMTC) par événements | Chrome et Spotify détectés ; changement de session suivi |
| Métadonnées, durée, position réglable, pochette | Présentes pour Chrome (lecture) et Spotify (pause) |
| Pochette servie par le protocole `quiera-art` | Chargée (image 150 px) |
| Couleur d'accent | Lecture des pixels possible ; pochette sombre → accent neutre, comme prévu |
| Activité en lecture | Pilule compacte avec pochette et barres |
| Lecteur développé | 520 × 140, pochette, titre, barre à jour, temps qui avance (2:39 → 2:41 en 2 s), boutons actifs |

**Incident rencontré :** le cache HTTP de la WebView2 de Quiera était corrompu (il servait `bench.ts` à la place de `springs.ts`), sans doute à cause des arrêts brutaux de WebView2 pendant les tests de l'étape 3. En développement, la page ne se chargeait plus. Corrigé en vidant `%LOCALAPPDATA%\app.quiera\EBWebView\Default\Cache` et `Code Cache`. La version optimisée n'utilise pas Vite et n'a pas montré ce problème.

## Passe « style Notchify » (28/10/2026)

Demandée par l'utilisateur à partir de captures de Notchify : ouverture au survol, fond noir OLED, intérieur épuré, paroles synchronisées.

| Point | Résultat |
|---|---|
| Fond de la pilule | Noir opaque (#000) dans tous les états |
| Ouverture au survol | Après 120 ms d'intention + 260 ms ; un passage rapide n'ouvre pas ; le clic ouvre toujours tout de suite (5 tests) |
| Paroles (LRCLIB) | 76 lignes reçues en 0,7 s ; titres YouTube nettoyés avant la recherche (10 tests) |
| Pilule compacte avec paroles | 386 × 30, ligne en cours au centre, qui défile vers le haut à chaque changement |
| Panneau | 676 × 176 : lecteur à gauche (pochette, titre, progression, aléatoire / précédent / lecture / suivant / répétition), paroles à droite |
| Aléatoire et répétition | État réel lu depuis Spotify ; commandes Windows reliées |
| Fluidité (écran ~180 Hz) | Ouverture : pire image 6 ms ; repos : 11 ms ; fermeture : 5,7 ms ; aucune au-delà de 20 ms |

Ce qui n'a **pas** été repris de Notchify : son code, ses icônes, ses dimensions exactes. Les paroles envoient titre, artiste, album et durée à lrclib.net ; un réglage pour les couper arrive à l'étape 5.

## Retours de l'utilisateur, corrections (28/10/2026)

| Retour | Correction | Vérifié |
|---|---|---|
| Deux temps au survol (grossissement puis ouverture) et délai | Ouverture dans le même rendu que le survol, après 60 ms d'intention | Un seul ressort de 150 à 676 px, départ ~120 ms après l'arrivée de la souris (mesure à 80 ms d'intention), léger rebond puis repos ~400 ms plus tard |
| Repos trop large, pas assez haut | 124 × 34 (au lieu de 190 × 30) ; activité 200 × 34, 236 × 34 avec paroles | Pilule de 150 px avec les évasements |
| Paroles sur deux lignes | Une phrase par ligne ; police réduite pour tenir (15 → 11 px) | 46 lignes, toutes à 27 px de haut, aucune ne déborde |
| Gros rectangles blancs | Plus de dégradé : chaque mot passe au blanc quand il est chanté | Aucun fond résiduel |
| Surlignage pas au rythme du chant | Horaire réel des mots quand la source le donne (LRC enrichi) ; sinon estimation : durée chantée ~70 ms par caractère (pas jusqu'à la ligne suivante), répartie selon la longueur des mots | Ligne en cours découpée en mots, mots chantés en blanc |
| Compact : mot par mot | Le mot chanté remplace le précédent | Pilule 262 × 34, un seul mot affiché |

**Limite :** LRCLIB n'a d'horaires par mot pour aucune des ~140 versions testées.

### Deux sources de paroles (choix de l'utilisateur : « les deux »)

1. **NetEase Cloud Music** (vrai mot par mot, format « yrc »), interrogé par le backend (`src-tauri/src/lyrics.rs`) avec un User-Agent qui identifie Quiera. API **non officielle** : elle peut changer ou bloquer, et elle n'est pas autorisée pour les applications tierces. Le titre, l'artiste et la durée partent vers ce service. Réglage pour la couper : étape 5.
2. **LRCLIB** en secours : horaires par ligne seulement, donc surlignage par **demi-phrase** (coupée après une virgule proche du milieu, sinon au milieu ; lignes de moins de 4 mots entières).

| Vérifié | Résultat |
|---|---|
| Couverture NetEase, 6 titres connus (dont 1 français) | 6/6 avec horaires par mot |
| Titre en cours pendant le test | Trouvé sur NetEase (titre, artiste et durée identiques) mais sans horaires par mot → LRCLIB, demi-phrases |
| Affichage demi-phrase | Ligne en cours en 2 moitiés ; pilule compacte 320 × 34 avec la demi-phrase |
| Lignes trop longues | 2 sur 41 finissent par « … », même à 10 px |
| Recherche de la bonne chanson | Titre + artiste + durée (±3 s) ; refuse une autre chanson plutôt que d'afficher de mauvaises paroles (5 tests) |

## Manuel

- [oui] Lancer une musique (Spotify, YouTube…) : la pilule s'élargit, pochette à gauche, barres à droite.
- [oui] Passer à la piste suivante depuis l'application : un aperçu apparaît 2 s avec le titre et l'artiste, et la pochette tourne.
- [oui] Mettre en pause : la pilule reste 8 s, puis revient au repos.
- [oui] Clic sur la pilule : le lecteur s'ouvre ; le temps avance ; un titre trop long défile.
- [oui] Lecture / pause : l'icône change tout de suite, la musique suit.
- [oui] Précédent / suivant : l'icône glisse, la piste change.
- [oui] Faire glisser la barre de progression : la musique saute à la position choisie.
- [oui] Sans aucune musique ouverte, clic sur la pilule : « Rien en lecture ».
- [oui] Une pochette colorée : la barre et les barres d'activité prennent sa couleur.
- [oui] Survoler la pilule sans cliquer : elle s'ouvre après un court instant ; passer vite dessus ne l'ouvre pas.
- [oui] Une chanson connue : les paroles défilent, la ligne en cours se remplit de blanc au rythme du chant.
- [oui] Clic sur une ligne de paroles : la musique saute à cette ligne.
- [oui] Aléatoire et répétition (aucune → liste → un titre) : l'icône s'allume, Spotify suit.
- [y pas de paroles sur les video youtube] Une vidéo YouTube : les paroles sont trouvées malgré « (Official Video) » dans le titre.
