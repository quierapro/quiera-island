# Décisions, direction artistique v2, noms et fonctionnalités

> Version 1, 27 octobre 2026. Complète [01-analyse-et-plan.md](01-analyse-et-plan.md).
> **La section F (direction artistique) du document 01 est remplacée par la section 3 ci-dessous.**

## 1. Décisions validées

| Sujet | Décision | Conséquence |
|---|---|---|
| Pile technique | Tauri 2 + Rust + React/TypeScript + Motion | Point de contrôle à l'étape 1 : RAM, focus |
| Licence | **GPL-3.0-or-later** (laissée à mon choix) | On peut reprendre légalement du code de Bloom (GPL-3.0-only) en conservant ses mentions de copyright. Les fichiers repris restent sous GPL-3.0-only, et l'ensemble est alors distribué sous GPL-3.0. Chaque reprise est listée dans `THIRD_PARTY_NOTICES.md`. |
| Plateformes | **Windows 11 d'abord**. macOS et Linux « si possible » | Couche `platform/` dès le départ (section 2). Le MVP n'implémente que Windows. |
| Style par défaut | Extérieur façon Bloom, intérieur inspiré de Notchify | Section 3 |
| Nom | **Quiera** (choisi le 27/10/2026, en dehors de la liste de la section 4) | Identifiant `app.quiera`, exécutable `quiera`, réglages dans `%APPDATA%\app.quiera` |
| Fonctionnalités retenues | Voir section 7 | — |

## 2. Stratégie multiplateforme

### 2.1 Principe

Toute fonction qui dépend du système passe par un **trait Rust** défini dans `src-tauri/src/platform/mod.rs`. Le MVP n'implémente que `platform/windows/`. Les implémentations macOS et Linux sont des stubs qui renvoient « non supporté ».

L'interface reçoit au démarrage un objet `capabilities` (par exemple `{ media: true, brightness: false, … }`). Chaque module se masque tout seul si sa capacité manque. Ainsi, un port n'exige **aucune modification** dans l'interface.

```
src-tauri/src/platform/
├─ mod.rs        # traits : IslandSurface, MediaSource, VolumeControl, PowerSource, SystemEvents
├─ windows/      # implémentation complète (MVP)
├─ macos/        # stubs → plus tard
└─ linux/        # stubs → plus tard
```

**Garde-fou.** Dès l'étape 0, la CI **compile** aussi sous macOS et Linux, sans les tester. Cela empêche du code Windows de s'infiltrer hors de `platform/windows/`.

### 2.2 Ce qu'un port coûterait réellement

| Besoin | Windows | macOS | Linux X11 | Linux Wayland |
|---|---|---|---|---|
| Fenêtre au-dessus de tout, sans focus | ✅ Win32 | ✅ `NSPanel` non activable, niveau au-dessus de la barre de menus (`objc2`) | ✅ | ⚠️ Exige le protocole **wlr-layer-shell** : disponible sur KDE, Hyprland et Sway, **absent de GNOME**. Tauri ne le gère pas nativement. |
| Clics hors de la pilule | ✅ `SetWindowRgn` | ⚠️ Pas de région de saisie : il faut basculer `ignoresMouseEvents` en suivant le curseur | ✅ XShape (région de saisie) | ✅ Région de saisie de la surface |
| Média | ✅ SMTC | ⚠️ MediaRemote est privé et restreint depuis macOS 15.4 (Boring Notch passe par un adaptateur) | ✅ MPRIS (D-Bus) | ✅ MPRIS |
| Volume | ✅ Core Audio | ✅ CoreAudio | ✅ PipeWire/PulseAudio | ✅ |
| Moteur web | WebView2 (Chromium) | WebKit | WebKitGTK | WebKitGTK |

**Conséquences sur le design et le code :**

- **Pas de CSS réservé à Chromium sans repli.** Par exemple, `corner-shape: squircle` et la fonction CSS `shape()` servent seulement d'amélioration, avec `border-radius` en secours. Les évasements de la pilule seront dessinés en **SVG**, pas avec `shape()`.
- WebKitGTK est nettement moins rapide pour les animations. Sur Linux, il faudra sans doute un profil d'animation allégé.
- Sur macOS, Boring Notch existe déjà et il est excellent : un port y apporterait peu. **Linux** (KDE, Hyprland, X11) est la cible secondaire la plus utile.

## 3. Direction artistique v2

### 3.1 Ce que « copier » veut dire ici

- **Bloom (extérieur)** : son code et ses styles sont sous GPL-3.0, compatibles avec notre licence. On peut **reprendre fidèlement** la silhouette, les évasements et les réglages de ressorts, avec attribution. Les SF Symbols restent exclus (licence Apple).
- **Notchify (intérieur)** : c'est un produit **commercial fermé**. Je reprends sa **structure** (une barre d'onglets en icônes, des cartes de widgets en grille, un lecteur avec panneau de paroles, une ligne de paroles dans la pilule compacte) et ses **principes** (noir pur, contenu qui apparaît avec un flou, accroche du survol). Je ne reprends **pas** ses dimensions exactes, ses icônes, ses thèmes ni son code.

  Deux raisons :
  1. **Juridique.** Une reproduction à l'identique de l'interface d'un concurrent commercial nous exposerait à une action pour contrefaçon ou pour **parasitisme**.
  2. **Ton objectif initial** : une identité propre.

  Le résultat ressemblera à la *famille* Notchify sans en être un clone.

### 3.2 Extérieur, façon Bloom

**Silhouette accolée (par défaut)**

- Le haut est collé au bord de l'écran, sans coins arrondis en haut.
- De chaque côté, un **évasement concave de 13 px** raccorde la pilule au bord de l'écran. C'est une courbe cubique dont les poignées sont plus longues que celles d'un arc de cercle, pour que la pilule « coule » dans le bord au lieu de faire un pli.
- Coins inférieurs : **18 px** en état compact, puis rayon progressif jusqu'à **28 px** en état développé.

**Silhouette flottante (option)**

- Pilule entièrement arrondie, à 8 px du haut, sans évasements.

**Matière**

| État | Fond |
|---|---|
| Compact | `rgba(0,0,0,0.82)` |
| Développé | `rgba(0,0,0,0.94)` |

- Le fond est **un seul calque** (pilule et évasements peints ensemble, puis atténués d'un bloc) : aucune couture claire ou sombre là où les pièces se rejoignent.
- Ombre seulement à l'état développé : `0 10px 30px rgba(0,0,0,0.45)`.

**Naissance (signature de Bloom)**

1. Au démarrage, une bulle de 34 × 34 apparaît sous le bord.
2. Elle monte, **touche** le bord et s'y fond : les évasements apparaissent et la pilule s'étire en largeur.

Cela dure environ 600 ms au total, une fois par lancement. C'est désactivable.

**Pastilles d'activité**

Quand une seconde activité vit en parallèle (minuteur pendant la musique), elle prend la forme d'une petite bulle détachée de 30 px, à droite de la pilule. Une simple bulle, pas une seconde pilule.

**Ressorts de la silhouette**

On part des valeurs de Bloom, puis on ajuste avec le mode lent. La fermeture est plus amortie, selon le principe partagé par Boring Notch et Notchify.

| Propriété | Ouverture | Fermeture |
|---|---|---|
| Largeur | raideur 400, amortissement 31 | raideur 400, amortissement 40 |
| Hauteur | 450 / 29 | 450 / 40 |
| Rayons | 1000 / 40 | 1000 / 40 |
| Position verticale (masquer/afficher) | 550 / 45, masse 0,8 | idem |

### 3.3 Intérieur, inspiré de Notchify

**Palette intérieure**

| Token | Valeur | Usage |
|---|---|---|
| `--ink` | `#000000` | Fond intérieur des panneaux |
| `--card` | `#121214` | Cartes de widgets |
| `--card-hover` | `#1A1A1D` | Survol des cartes |
| `--text-1` | `#FFFFFF` | Titres, ligne de paroles active |
| `--text-2` | `rgba(255,255,255,0.62)` | Artiste, libellés |
| `--text-3` | `rgba(255,255,255,0.36)` | Durées, paroles inactives |
| `--fill-active` | `rgba(255,255,255,0.12)` | Onglet actif, bouton pressé |
| `--accent` | Couleur extraite de la pochette (saturation limitée, luminance entre 55 et 75 %) ; sinon blanc | Progression, balayage des paroles |

**Typographie**

- *Segoe UI Variable* sous Windows 11, avec repli sur *Segoe UI* puis la police système (macOS et Linux).
- Paroles : **graisse 800, 15 px**, interligne 1,2.
- Titres : 14/600. Métadonnées : 12/400. Chiffres tabulaires pour les durées.

**Formes**

- Cartes et pochettes en **squircle** (coins en super-ellipse) : `corner-shape: squircle` sous WebView2, `border-radius` en repli ailleurs.

**Pilule compacte pendant la lecture (≈ 230 × 30)**

- À gauche : la pochette en 18 × 18 (squircle).
- Au centre : la **ligne de paroles en cours**. Elle défile verticalement (8 px, 200 ms) quand la phrase change. Sans paroles : titre — artiste, avec défilement si le texte dépasse.
- À droite : 4 barres d'activité.

**Lecteur développé (≈ 600 × 196)**

```
┌──────────────────────────────────────────────────────────────┐
│ [♪] [▦] [⧉] [⇅] [⏱]                                      ⚙  │  ← onglets 32×24, pastille active
│ ┌────────┐  Titre de la piste                │  ligne passée  │
│ │pochette│  Artiste                          │ LIGNE ACTIVE   │  ← paroles : active en blanc,
│ │ 104×104│  ━━━━━━━━━━━━━━━━━━━──────  2:14  │  ligne suivante│    les autres atténuées et
│ └────────┘   ⤮    ⏮    ⏯    ⏭    ↻         │  …             │    légèrement floues
└──────────────────────────────────────────────────────────────┘
```

- Le panneau des paroles occupe environ 40 % de la largeur, avec un fondu en haut et en bas. Un **balayage de couleur** (`--accent`) parcourt la ligne active au rythme du minutage.
- Un clic sur une ligne de paroles positionne la lecture à cet endroit.
- Sans paroles disponibles, le panneau devient une **pochette floutée en fond** avec le titre en grand.

**Barre d'onglets** (en haut du panneau développé)

- Icônes de 20 px dans des cibles de 32 × 24. L'onglet actif a une pastille `--fill-active` de 12 px de rayon. Pression : échelle 0,95 ; survol : 1,05.
- Onglets du MVP : **Lecture**, **Contrôles**. Ajoutés en P2 : **Shelf**, **Minuteur**, **Widgets**, **Presse-papiers**.
- Engrenage à droite pour ouvrir les réglages.

**Onglet Widgets (P2)**

- **2 colonnes** de cartes d'environ 264 × 140, 12 px d'espacement, rayon 20 (squircle).
- Chaque cellule peut contenir plusieurs widgets, qu'on fait défiler à la molette. Des points d'indication sous la carte : 2,5 px pour l'actif, 1,8 px pour les autres.

**Apparition du contenu**

- **Entrée** : opacité 0 → 1, flou 10 → 0 px, translation verticale 4 → 0, en 220 ms (`ease-out-cubic`), **60 ms après** le début du mouvement de la silhouette.
- **Sortie** : 90 ms, sans flou.

**Accroche du survol**

Idée reprise du comportement de Notchify, et code entièrement à nous. Quand la pilule **rétrécit sous un curseur immobile** (changement d'onglet, retour à l'accueil), on garde l'état « survolé » pendant que le ressort se stabilise. On ne le relâche que quand le curseur s'éloigne **nettement**, de 12 px au-delà du point le plus proche atteint. Cela supprime le cas où l'île se replie toute seule sous la souris. Ce mécanisme complète la rétention de la région prévue dans le document 01.

### 3.4 Dimensions à tester (pixels logiques)

| État | Taille | Silhouette accolée |
|---|---|---|
| `idle` | 190 × 30 | coins bas 15 |
| `idle` + survol | 200 × 32 | 16 |
| `activity` (lecture) | 230 × 30 | 15 |
| `peek` (piste suivante, volume) | 340 × 44 | 20 |
| `expanded` lecteur | 600 × 196 | 28 |
| `expanded` contrôles | 600 × 220 | 28 |
| `expanded` widgets (P2) | 600 × 340 | 28 |
| Fenêtre Win32 | 680 × 380 (marge d'ombre et évasements compris) | — |

Le contenu est centré sur l'axe de la pilule, avec 16 px de marge latérale et 14 px de marge basse.

## 4. Propositions de nom

Je n'ai cherché que des projets **GitHub** portant ces noms. Je n'ai vérifié ni les dépôts de marques ni la disponibilité des noms de domaine.

| Nom | Idée | Résultat de la recherche GitHub |
|---|---|---|
| **Nacre** ⭐ | L'intérieur irisé d'un coquillage : **sombre dehors, riche dedans**, exactement notre concept visuel. Se dit pareil en français et en anglais. | Un petit projet de shell (36 ★), aucune collision dans notre domaine |
| **Galet** ⭐ | Une pierre lisse et arrondie, posée au bord : la forme même de la pilule. Court, doux, français. | Aucun dépôt « galet » orienté Windows trouvé |
| **Brume** | Apparaît, se dissipe, ne gêne jamais | Un thème Jekyll, sans collision |
| **Orbe** | La bulle de naissance | Aucune collision Windows |
| **Lagune** | L'eau calme abritée par un îlot | Non vérifié (limite de requêtes de l'API) |
| **Perle** | Petit, précieux, noir possible | Non vérifié |
| **Îlo** | Diminutif d'« îlot », direct et lisible | Non vérifié |

**À éviter :**

- *Atoll* : une application macOS du même genre porte déjà ce nom ;
- *Notch…* et *Dynamic Island* : marque d'Apple, et confusion avec Notchify ;
- *Bloom*.

**Ma recommandation : Nacre.** Le nom raconte le design (une coque noire mate, un intérieur précieux) et fonctionne à l'international.

## 5. Fonctionnalités supplémentaires proposées

Légende : ✅ API publique · ⚠️ possible avec des limites · ❌ pas d'API publique.

### 5.1 Fort impact, coût faible (à ajouter en P2)

| Fonction | Pourquoi | Faisabilité |
|---|---|---|
| **Paroles synchronisées** | C'est le cœur de l'intérieur inspiré de Notchify | ✅ LRCLIB (API ouverte, gratuite, sans clé) ; à activer dans les réglages (accès réseau) |
| **Aperçu de charge** | Brancher le chargeur → la pilule s'étire avec le pourcentage et une animation verte. Un moment de plaisir quotidien. | ✅ `WM_POWERBROADCAST` / `GetSystemPowerStatus` |
| **Aperçu de connexion d'un casque Bluetooth** | Nom et batterie quand des écouteurs se connectent | ⚠️ La connexion se détecte facilement ; la batterie dépend des appareils (BLE, ou propriété PnP) |
| **Micro coupé ou actif** | Un point rouge permanent si le micro est utilisé ; un raccourci global pour le couper pendant un appel | ✅ Couper : Core Audio (périphérique de capture). ⚠️ Savoir qu'il est utilisé : registre `CapabilityAccessManager` |
| **Mixeur par application** | Régler le volume de Spotify et de Discord séparément depuis le panneau Contrôles | ✅ `IAudioSessionManager2` |
| **Verr. Maj et changement de disposition clavier** | Un petit aperçu « VERR. MAJ » ou « FR → EN » | ✅ Lecture légère de l'état des touches, sans hook clavier |
| **Météo dans l'état `idle`** | Une icône et la température à droite de la pilule au repos | ✅ Open-Meteo (sans clé) |
| **Capture d'écran → Shelf** | Après une capture (Win+Maj+S), l'image apparaît dans le Shelf, prête à être glissée | ✅ Surveillance du presse-papiers (`AddClipboardFormatListener`) |

### 5.2 Différenciantes (P2–P3)

| Fonction | Pourquoi | Faisabilité |
|---|---|---|
| **Envoi vers le téléphone via LocalSend** | Glisser un fichier du Shelf sur un appareil de la liste. Le protocole est ouvert : c'est le « AirDrop » qui manque à Windows. | ✅ Protocole LocalSend documenté et open source (licence à vérifier avant usage) |
| **OBS** | Pastille rouge et durée pendant un enregistrement ou un stream ; démarrer ou arrêter depuis l'île | ✅ obs-websocket (intégré à OBS depuis la version 28) |
| **Minuteur de réunion** | « Réunion dans 5 min » depuis un calendrier ICS (Google ou Outlook, via une URL privée) | ✅ Lecture d'un flux ICS ; l'API Calendrier de Windows exigerait un package |
| **Pomodoro ancré dans la pilule** | Une activité `live` avec un anneau de progression autour de la pochette ou de la pastille | ✅ |
| **Historique du presse-papiers** | Notchify l'a ; complémentaire de Win+V par le glisser-déposer vers les applications | ✅ `AddClipboardFormatListener` |
| **Teinte ambiante** | Une très légère lueur sous la pilule, teintée par la pochette (désactivable). Seule concession « couleur » de l'extérieur. | ✅ |

### 5.3 Plus tard ou expérimentales

| Fonction | Faisabilité |
|---|---|
| Téléchargements en cours (fichiers `.crdownload`/`.part` dans Téléchargements) | ⚠️ On détecte la présence d'un téléchargement, pas sa progression exacte |
| Indicateur de bureau virtuel | ⚠️ Pas d'événement public de changement de bureau |
| Commandes Spotify enrichies (aimer un titre) | ⚠️ Connexion OAuth avec l'API Spotify |
| Notifications Windows | ⚠️ Exigent un package MSIX (document 01, C.4) |
| Sélecteur de sortie audio par défaut | ❌ Interface non documentée (`IPolicyConfig`). On se limite à ouvrir les réglages de son. |
| Progression des barres de tâches d'autres applications | ❌ Pas d'API publique |

## 6. Ce qui change dans le plan (document 01, section E)

- **Étape 0** : ajoute `src-tauri/src/platform/` (traits et stubs) et la compilation macOS et Linux en CI.
- **Étape 1** : la pilule statique adopte la **silhouette accolée avec évasements en SVG**.
- **Étape 2** : ajoute l'**animation de naissance** et l'**accroche du survol** ; les ressorts partent des valeurs de Bloom.
- **Étape 4 (média)** : la pilule compacte et le lecteur développé suivent la section 3.3. Le panneau des paroles est **préparé** dans la mise en page, mais LRCLIB n'arrive qu'en P2-a, juste après la v0.1.
- **P2**, nouvel ordre proposé :
  1. paroles ;
  2. aperçus de charge, de casque et de micro ;
  3. Shelf et capture vers le Shelf ;
  4. minuteur et Pomodoro ;
  5. widgets en grille et météo ;
  6. mixeur par application.

## 7. Fonctionnalités retenues (27/10/2026)

Choix de l'utilisateur, en plus du MVP du document 01 :

| Fonction | Origine | Prévue à |
|---|---|---|
| **Lecteur audio repris de Bloom** (dispositions « classic » et « compact », commandes, progression, pochette) | Code de Bloom (`src/CompactMediaPlayer.tsx`, mode musique de `src/App.tsx`, worker SMTC de `src-tauri/src/services.rs`), sous GPL-3.0-only, adapté à notre architecture de modules et piloté par événements | Étape 4 |
| Paroles synchronisées (LRCLIB) | Section 5.1 | P2-a, juste après la v0.1 |
| Animation au branchement du chargeur | Section 5.1 | Étape 6 |
| Aperçu de connexion d'un casque, avec sa batterie | Section 5.1 | P2 |
| Indicateur de micro et raccourci pour le couper | Section 5.1 | P2 |
| Volume par application | Section 5.1 | Étape 6 |
| Aperçu de Verr. Maj | Section 5.1 | Étape 6 |
| Météo | Section 5.1 | P2 |
| Captures d'écran vers le Shelf | Section 5.1 | P2, avec le Shelf |
| **Historique du presse-papiers** | Section 5.2 | P2 |
| **Envoi vers le téléphone avec LocalSend** | Section 5.2. Application LocalSend sous Apache-2.0 ; on implémente le protocole d'après sa documentation publique, sans copier de code | P2, après le Shelf |

**Reprise de code de Bloom.** Chaque fichier repris garde son en-tête de copyright et est listé dans `THIRD_PARTY_NOTICES.md` avec les modifications. Les icônes SF Symbols de Bloom ne sont **pas** reprises : nos propres glyphes les remplacent.
