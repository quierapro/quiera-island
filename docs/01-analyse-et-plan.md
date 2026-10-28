# Île pour Windows : analyse des références, architecture et plan

> Document de travail, version 1, 27 octobre 2026.
> Nom du produit à définir (le dossier s'appelle « nom a trouver »). Dans ce document : « l'île » pour la pilule, « le projet » pour l'application.
>
> **Mise à jour du 27/10/2026 :** les décisions de la section I sont prises, et la direction artistique (section F) est remplacée. Voir [02-decisions-design-fonctionnalites.md](02-decisions-design-fonctionnalites.md).

## 0. Méthode et limites de cette analyse

**Ce qui a été lu directement (clone Git, lecture du code) :**

| Dépôt | Révision lue | Ce qui a été examiné |
|---|---|---|
| `SehajveerSingh2005/bloom` | `fa32e83` (v3.10.1) | manifestes (`package.json`, `Cargo.toml`, `tauri.conf.json`), `AGENTS.md`, `src-tauri/src/*.rs` (fenêtres, hooks, région, média, récupération), `src/App.tsx` (pilule), `src/windowRegion.ts`, audit interne `docs/audit/…` |
| `TheBoredTeam/boring.notch` | `23e7705` | `ContentView.swift`, `NotchShape.swift`, `sizing/matters.swift`, `animations/drop.swift`, `BoringNotchSkyLightWindow.swift`, `MusicVisualizer.swift`, services du Shelf, `THIRD_PARTY_LICENSES`, dépendances du `.xcodeproj` |
| `lb-li/WinIsland` | dernier commit 2026-03-05 | `.csproj`, structure, `Utilities/Spring.cs`, notifications |
| `FlorianButz/DynamicWin` | dernier commit 2025-10-19 | le dépôt ne contient plus de code (« Remove initial version »), seulement `LICENSE` et README |
| `thanvish21/dynamic-island` | dernier commit 2026-09-08 | structure, licence |
| Mods Windhawk (`ramensoftware/windhawk-mods`) | `main` | en-têtes et techniques de rendu de `dynamic-island-for-windows`, `island-media-controls`, `mac-island-dock`, `taskbar-music-lounge` |

**Ce qui n'a pas été fait :**

- Je n'ai **exécuté aucun** de ces logiciels. Toutes les remarques sur le comportement viennent du code ou des pages publiques, pas d'un test en conditions réelles. Les ressentis (« fluide », « qualité premium ») ne sont donc pas vérifiés.
- **Notchify est propriétaire.** Je n'ai lu que sa page publique `notchify.app`. Aucune affirmation sur son code ou son architecture interne ne doit être tirée de ce document au-delà de ce que la page déclare.
- Les chiffres de consommation mémoire cités pour WebView2 viennent de sources tierces hétérogènes. Ils devront être **mesurés** sur ta machine pendant l'étape 1.

**Correction importante :** Notchify (notchify.app) n'est pas une application macOS. C'est une application **Windows uniquement**, payante sur le Microsoft Store, avec un essai gratuit. Sa page précise que les applications macOS du même nom n'ont aucun rapport. C'est donc ton concurrent le plus direct.

---

## A. Étude comparative

### A.1 Tableau de synthèse

| | **Bloom** | **Boring Notch** | **Notchify** | **WinIsland** | **Windhawk « Dynamic Island for Windows »** | **dynamic-island (thanvish21)** | **DynamicWin** |
|---|---|---|---|---|---|---|---|
| Plateforme | Windows | macOS 14+ | Windows 10 1809+ / 11 | Windows | Windows (dans le processus Windhawk) | Windows, Linux | Windows |
| Technologies | Tauri 2.11, Rust, React 19, framer-motion 12, Tailwind 4, crate `windows` 0.61 | Swift, SwiftUI, AppKit, Lottie, Sparkle | « natif, pas une page web » (déclaré) | C#, WPF, .NET 8, NAudio | C++, Direct2D, `UpdateLayeredWindow` (≈ 24 000 lignes, un seul fichier) | Tauri, Rust, Svelte | C# (d'après une source tierce) |
| Licence | GPL-3.0-only | GPL-3.0 | Propriétaire | **Aucun fichier de licence** : tous droits réservés | MIT | MIT | CC BY-SA 4.0, code retiré |
| Code consultable | Oui | Oui | Non | Oui | Oui | Oui | Non |
| Média | Oui (SMTC, visualiseur FFT réel) | Oui (MediaRemote, visualiseur **simulé**) | Oui, avec paroles synchronisées | Oui | Oui | Oui | Oui (annoncé) |
| Shelf (fichiers) | Oui | Oui (le plus abouti) | Oui (« File tray ») | Oui (« File Station ») | non vérifié | Non (presse-papiers) | Oui (annoncé) |
| Contrôles système | Wi-Fi, Bluetooth, volume, luminosité, batterie | HUD volume, luminosité, batterie | Volume, luminosité, sortie audio, actions rapides | Partiels | Partiels | Système | non vérifié |
| Notifications | Non | Non | Oui | Oui (`UserNotificationListener`) | non vérifié | Oui | non vérifié |
| Périmètre | Île **et** remplacement de la barre des tâches (dock) | Île seulement | Île seulement, plus de 20 widgets | Île | Île | Île | Île |
| Points forts | Intégration Windows profonde et éprouvée ; ressorts bien réglés ; code de robustesse précieux (région de fenêtre, récupération WebView2, veille) | Cohérence visuelle ; forme de l'encoche ; ressorts ouverture/fermeture différenciés ; Shelf | Produit complet et cohérent ; personnalisation ; masquage en plein écran ; exclusion de l'enregistrement d'écran | Simplicité ; ressort maison lisible | Rendu natif très léger ; ressorts sur largeur et hauteur ; calage sur `DwmFlush` | Architecture proche de la nôtre, MIT | — |
| Limites | Monolithes (`App.tsx` 4 729 lignes, `services.rs` 4 691, `commands.rs` 4 417) ; état éclaté en dizaines de booléens ; 4 WebView ; hooks clavier et souris globaux ; faux positifs Defender documentés dans le README ; icônes SF Symbols | macOS uniquement ; API privées (SkyLight, MediaRemote) | Fermé, payant | Pas de licence ; WPF transparent | Le coût d'une interface dessinée à la main : 24 000 lignes pour un seul fichier | Jeune, petit | Plus de code source |
| À étudier pour nous | Région de fenêtre, transparence au clic, ressorts, récupération après crash, multi-écran | Forme, différence ouverture/fermeture, intention de survol, organisation du Shelf | Liste des fonctions, réglages, comportement en plein écran | Ressort minimal | Hit-testing natif, rythme d'image | Structure Tauri minimale | — |

### A.2 Ce qui est démontré et ce qui est seulement annoncé

- **Bloom** : les fonctions du README existent dans le code (média, Command Center, calendrier, Pomodoro, Shelf, dock). Le README présente toutefois des affirmations marketing (« Every transition is a physics simulation »), et des emplacements prévus pour des vidéos de démonstration restent vides. Je n'ai pas pu vérifier le comportement réel.
- **Boring Notch** : le README annonce un visualiseur audio. Dans le code, `MusicVisualizer.swift` (l. 59 et 73) **tire des hauteurs au hasard toutes les 0,3 s**. Il n'analyse pas le son.
- **Notchify** : la note Store (4,0/5) et le nombre de téléchargements (plus de 4 000) sont déclarés par l'éditeur. L'architecture « native » et l'affichage jusqu'à 240 Hz sont aussi des déclarations. Rien n'a été vérifié.
- **DynamicWin** : le dépôt ne sert plus qu'à publier des versions. Les fonctionnalités ne sont vérifiables qu'en installant l'application.

---

## B. Analyse technique

### B.1 Bloom

#### Organisation

D'après `AGENTS.md` et `tauri.conf.json`, Bloom ouvre **4 fenêtres WebView**, chacune avec son point d'entrée Vite :

| Fenêtre | Taille | Rôle |
|---|---|---|
| `main` (l'île) | 1920 × 420, transparente, toujours au premier plan | La pilule |
| `dock` | 1920 × 600 | Le dock |
| `overlay` | 1920 × 1080 | Les HUD |
| `settings` | — | Les réglages |

Côté Rust :

- `main.rs` déclare tous les modules et enregistre environ 100 commandes `#[tauri::command]`.
- `commands.rs` contient la surface IPC.
- `services.rs` contient les workers de longue durée : hooks, média, visualiseur, AppBar.
- `utils.rs` gère les réglages et les fichiers.

Le backend parle à l'interface par `app.emit` (`media-update`, `volume-change`, `notch-overlap`…). L'interface appelle le backend par `invoke`.

#### Éviter que l'overlay bloque les clics : le point le plus instructif

Une fenêtre transparente de 1920 px capte tous les clics, même là où elle ne dessine rien. Bloom combine trois mécanismes :

1. **Région de fenêtre** (`src-tauri/src/window_region.rs`). `SetWindowRgn` limite à la fois le dessin et le hit-testing à l'union de rectangles envoyés par l'interface (en pixels CSS, convertis en pixels physiques et arrondis vers l'extérieur). Hors de la région, la fenêtre n'existe plus pour la souris. Détail important : la fenêtre doit être `WS_EX_LAYERED` **avant** d'appliquer la région, sinon les pixels transparents deviennent opaques.
2. **Rétention de la région pendant les rétrécissements** (`src/windowRegion.ts`, `nextRegion`). Quand la pilule grandit, la nouvelle région s'applique tout de suite. Quand elle rétrécit, l'ancienne est conservée 700 ms, le temps que l'animation se termine sans être rognée. La région est calculée à partir de la **géométrie cible** de la pilule, pas de sa taille animée (`pillTargetRef` dans `App.tsx`). C'est une idée simple et très efficace.
3. **Bascule `WS_EX_TRANSPARENT`** pilotée par un hook souris global `WH_MOUSE_LL` (`services.rs`, `setup_mouse_hook` et `update_main_interaction`). Ce hook est limité à 32 ms, réinstallé automatiquement si Windows le supprime (`run_mouse_hook_thread`) et complété par une marge d'hystérésis de 10 px pour éviter le scintillement à la frontière. Deux cas particuliers :
   - Quand le curseur devient transparent au clic, le backend émet `notch-pointer-left`, car la WebView ne reçoit plus le `mouseleave`.
   - Un glisser-déposer OLE ne peut pas viser une fenêtre `WS_EX_TRANSPARENT`. Bloom détecte donc le bouton gauche maintenu (`GetAsyncKeyState`) pour rendre la fenêtre interactive pendant un glisser.

**Leçon :** le mécanisme 3 est complexe parce que la fenêtre est immense et que Bloom gère aussi un dock. Une fenêtre de la taille maximale de l'île, avec une région bien tenue (mécanismes 1 et 2), suffit pour la plupart des cas. Le hook global ne serait alors plus nécessaire dans le MVP (voir D.6).

#### Focus

- `re_assert_topmost` (`utils.rs`, l. 1332) appelle `SetWindowPos(HWND_TOPMOST, SWP_NOACTIVATE…)`, puis réapplique `WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW`. Selon le commentaire du code, le shell peut retirer ces styles sur certaines versions de Windows.
- La fenêtre est créée avec `focus: false` et `skipTaskbar: true`.

#### La pilule (`src/App.tsx`, l. 3113–3230)

- Un seul `motion.div` anime `width`, `height`, `y`, les quatre rayons, l'opacité et un flou. Les ressorts sont réglés séparément :

  | Propriété | Raideur (stiffness) | Amortissement (damping) |
  |---|---|---|
  | `width` | 400 | 31 |
  | `height` | 450 | 29 |
  | `y` | 550 | 45 (masse 0,8) |
  | rayons | 1000 | 40 |

  La hauteur varie selon le mode (`getDynamicHeight`), par exemple calendrier 273/305, Shelf 130/176/190, Wi-Fi 300.
- Le contenu change avec `AnimatePresence mode="wait"` et des fondus courts (0,1–0,15 s).
- L'état est éclaté : `isExpanded`, `isHovered`, `isNotchHovered`, `isEdgeHovered`, `isVisible`, `isHidden`, `isImpacted`, `interactionState` (`active`/`grace`/`none`, grâce de 800 ms), `bloomMode` (une dizaine de valeurs), `notchMode`… `isHidden` est une expression booléenne qui combine 5 conditions. **C'est précisément ce que tu veux éviter** : chaque nouveau mode ajoute des branches dans `getDynamicWidth`/`getDynamicHeight`, plus des effets qui se croisent.

#### Média

- `services.rs`, `setup_system_worker` : `GlobalSystemMediaTransportControlsSessionManager` (SMTC) est **interrogé en boucle toutes les 64 ms**. Le périphérique audio par défaut est vérifié toutes les 2 s.
- Le visualiseur (`setup_audio_visualization`) utilise une capture WASAPI en boucle de retour (`AUDCLNT_STREAMFLAGS_LOOPBACK`) et une FFT `rustfft` sur 5 bandes. Il est mis en pause quand rien ne joue.

**Leçon :** SMTC fournit des événements (`SessionsChanged`, `MediaPropertiesChanged`, `PlaybackInfoChanged`, `TimelinePropertiesChanged`). Une version pilotée par événements coûte presque rien au repos.

#### Robustesse

- **Crash de WebView2** (`watch_webview_processes`, `recover_from_webview_failure`) : en cas d'événement `ProcessFailed`, Bloom redémarre l'application. Si la panne survient moins de 30 s après le lancement, il quitte proprement au lieu de boucler.
- **Écran** : une fenêtre cachée `BloomDisplayMonitor` reçoit `WM_DISPLAYCHANGE` et le message `TaskbarCreated` (redémarrage d'Explorer).
- **Instance unique** : mutex nommé et événement nommé, ce qui permet de rouvrir les réglages depuis une seconde instance.
- **Barre des tâches** : parce que Bloom la masque, il lui faut un **processus watchdog** (`--taskbar-watchdog`) et un fichier marqueur pour la restaurer après un crash. C'est une source majeure de complexité, que nous évitons en **ne remplaçant pas la barre des tâches**.
- **Plein écran et outils de capture** : l'île s'efface (`CURRENT_FOREGROUND_FULLSCREEN`). Le cas de l'Outil Capture d'écran est traité en dur par nom de processus (`capture_ui_enum_proc`).
- **OSD natif de volume** : il est masqué via `FindWindow("NativeHWNDHost")` puis `SW_HIDE`. C'est un bricolage non documenté et fragile.

#### Réglages

- Fichier `%APPDATA%/bloom/settings.json`, clés plates préfixées, **toutes les valeurs en chaînes** (`"true"`), avec un miroir dans `localStorage`.
- L'audit du 14 octobre 2026 décrit des courses entre les 4 WebView sur ce fichier. Elles ont été corrigées par des écritures sérialisées et atomiques.

**Leçon :** un seul propriétaire des réglages (le backend), typé et versionné, dès le départ.

#### Tests et CI

- Tests unitaires Rust sur des fonctions pures, que la CI n'exécute pas (`AGENTS.md`).
- Quelques tests TypeScript dans `scripts/*.test.ts`.
- Pas de script de lint ni de tests frontend.

### B.2 Boring Notch

#### Fenêtre

`BoringNotchSkyLightWindow.swift` est un `NSPanel` non activable :

- `level = .mainMenu + 3`, `collectionBehavior = [.fullScreenAuxiliary, .stationary, .canJoinAllSpaces, .ignoresCycle]`, apparence sombre forcée ;
- l'API privée **SkyLight** sert à afficher la fenêtre au-dessus de tout, y compris de l'écran de verrouillage ;
- une option masque la fenêtre des enregistrements d'écran.

L'équivalent Windows de ce dernier point est `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`, disponible depuis Windows 10 2004.

#### Forme (`NotchShape.swift`, d'après DynamicNotchKit, licence MIT)

- Le tracé utilise des courbes quadratiques avec deux rayons animables (`animatableData`) : le **rayon du haut** dessine l'évasement concave qui raccorde l'encoche au bord de l'écran, celui du bas l'arrondi convexe.
- Les rayons valent 6/14 fermé et 19/24 ouvert (`sizing/matters.swift`).
- Taille ouverte : **640 × 190**. Taille fermée : la largeur réelle de l'encoche matérielle (`auxiliaryTopLeftArea`).

#### Animation (`ContentView.swift`)

- **Ouverture** : ressort `response 0.42`, `dampingFraction 0.8` (léger rebond).
- **Fermeture** : `response 0.45`, `dampingFraction 1.0`, donc **aucun rebond**.
- **Survol** : `interactiveSpring(0.38, 0.8)`, un seul ressort partagé pour les mouvements et les redimensionnements (le commentaire dit « to avoid conflicting animations »).

**Leçon directement transposable :** on ouvre avec du caractère et on ferme avec calme.

#### Interactions (`handleHover`, l. 513)

- Survol : la pilule grossit légèrement tout de suite. Elle ne s'ouvre qu'après `minimumHoverDuration`, ce qui exprime l'intention de l'utilisateur.
- Sortie : fermeture après 100 ms, sauf si un popover ou un partage est en cours.
- Clic : ouverture immédiate.
- Gestes de balayage vers le haut et vers le bas, retour haptique.

#### Activités temporaires (« sneak peek »)

`BoringViewCoordinator.swift` définit `SneakContentType` : `brightness`, `volume`, `backlight`, `music`, `mic`, `battery`, `download`.

En état fermé, la pilule s'élargit (« chin ») pour afficher une activité. Le calcul de cette largeur (`computedChinWidth`) souffre du même problème de conditions imbriquées que Bloom.

#### Shelf (`components/Shelf/…`)

- Le code est séparé en modèles, vues-modèles et services : miniatures, QuickLook, partage, ZIP, fichiers temporaires.
- Les fichiers sont conservés sous forme de **références** (signets de sécurité macOS) et non de copies. Ces références sont revalidées au chargement.
- Le texte déposé devient un fichier temporaire.

#### Dépendances

Sparkle, Defaults, KeyboardShortcuts, LaunchAtLogin-Modern, Lottie, Pow, SwiftUI-Introspect, SkyLightWindow, et un adaptateur MediaRemote (BSD-3), nécessaire parce que macOS 15.4 a restreint MediaRemote.

**Rien de tout cela n'est réutilisable sous Windows.** Seuls le design et les comportements comptent pour nous.

### B.3 Notchify (page publique uniquement)

**Fonctions annoncées :**

- musique avec paroles synchronisées « karaoké » ;
- notifications Windows regroupées par conversation ;
- historique du presse-papiers, file tray (Shelf) ;
- **enregistrement d'écran**, l'île étant exclue de la vidéo ;
- batterie des appareils Bluetooth, y compris BLE ;
- indicateurs micro et caméra, sélecteur de sortie audio ;
- Control Center, moniteurs système, actions rapides, raccourcis d'applications ;
- plus de 20 widgets, organisés en carrousel ou en grille.

**Personnalisation :**

- styles « Notch » et « Island » ;
- 8 positions possibles ;
- choix de l'écran, ou île qui suit le curseur ;
- 14 thèmes et un éditeur de thème ;
- jusqu'à 240 Hz ;
- « Hover to Show » ;
- masquage par défaut en plein écran ;
- widgets rafraîchis seulement quand ils sont visibles.

**Positionnement :** natif (pas une page web), aucun compte, aucune télémétrie.

**Ce qu'on en retient :**

1. Le produit vend un **comportement au quotidien** : masquage en plein écran, rafraîchissement seulement quand c'est visible, exclusion des captures. La liste de widgets compte moins.
2. Deux styles (accolé au bord ou flottant) répondent à une vraie attente sur un écran sans encoche.
3. Les notifications supposent l'API `UserNotificationListener`, qui exige une **identité de package** (MSIX). C'est cohérent avec une distribution par le Store (voir C.4).

### B.4 Alternatives Windows

**WinIsland** (C#, WPF, .NET 8, environ 3 700 lignes)

- Animation : un ressort maison (`Utilities/Spring.cs`, raideur 360, amortissement 28, intégration explicite), mis à jour à chaque `CompositionTarget.Rendering`.
- Notifications : `UserNotificationListener`, avec un test de présence de l'API.
- **Aucune licence : on peut lire le code, pas le copier.**

**Mods Windhawk.** Ils montrent la voie entièrement native :

- **Dynamic Island for Windows** (MIT) :
  - rendu Direct2D vers une fenêtre en couches (`UpdateLayeredWindow`) ;
  - `WM_NCHITTEST → HTTRANSPARENT` pour laisser passer les clics ;
  - ressorts séparés pour la largeur et la hauteur, avec des préréglages (« snappy »…) ;
  - images cadencées sur `DwmFlush` ;
  - `timeBeginPeriod(1)` pendant les animations ;
  - gestion de `WM_POWERBROADCAST`, `WM_DPICHANGED` et `WM_DISPLAYCHANGE`.
- **Island Media Controls** (MIT) : injecté dans `explorer.exe`, il utilise DirectComposition (`WS_EX_NOREDIRECTIONBITMAP`) et `SetWindowDisplayAffinity`.
- **Mac Island & Dock** (GPL-3.0) : environ 89 000 lignes.

**Leçon :** le rendu natif est le plus léger, mais chaque bouton, chaque texte, chaque défilement s'écrit à la main. Ces fichiers uniques de 24 000 à 89 000 lignes en sont le coût visible.

**dynamic-island (thanvish21)** (Tauri, Svelte, MIT) : une pilule toujours au premier plan, avec des widgets (presse-papiers, média, notifications, système, minuteur, météo). C'est un bon point de comparaison pour une base Tauri minimale.

---

## C. Recommandation produit

### C.1 Vision

> Une île qui **n'existe que quand elle sert**. Calme au repos, précise quand on la touche, jamais dans le passage.

**Trois piliers :**

1. **Le mouvement comme langage.** Une seule surface qui se transforme. Jamais de fenêtres qui apparaissent l'une sur l'autre. Les ressorts sont interruptibles : on peut changer d'avis en plein geste.
2. **La discrétion système.** L'île ne vole jamais le focus et ne bloque jamais un clic. Elle disparaît en plein écran et ne reste jamais figée à l'écran.
3. **Peu de fonctions, toutes impeccables.** Mieux vaut cinq modules parfaits que vingt widgets approximatifs.

### C.2 Ce qui nous différenciera

| Face à | Notre différence |
|---|---|
| Bloom | Une île **seule**, sans remplacer la barre des tâches. Une architecture modulaire avec une vraie machine à états. Aucun hook clavier global dans le MVP (moins d'alertes antivirus). Un backend piloté par événements. |
| Notchify | **Open source** et gratuit. Une API de modules documentée. |
| Boring Notch | Pensé pour Windows : pas d'encoche matérielle, multi-écran, DPI mixtes. |
| Tous | Une identité visuelle propre (voir F), et un **mode lent** pour régler les animations, livré dans les réglages développeur. |

### C.3 Périmètre du MVP (version 0.1)

**Inclus :**

1. L'île : états, ressorts, survol et clic, transparence au clic, focus, plein écran, multi-écran et DPI, veille et reprise.
2. Le média : titre, artiste, pochette, lecture/pause/précédent/suivant, progression, changement de source.
3. Les aperçus temporaires : changement de piste, volume.
4. L'icône de la zone de notification (afficher/masquer, réglages, quitter).
5. Les réglages persistants : taille, position, écran, comportement, démarrage automatique.
6. La robustesse : instance unique, journal, reprise après crash de WebView2.

**Exclus du MVP (et pourquoi) :**

| Exclu | Raison |
|---|---|
| Remplacer la barre des tâches, dock | Énorme surface de bugs (AppBar, watchdog, restauration) ; hors vision |
| Masquer l'OSD natif de volume | Bricolage non documenté (`FindWindow("NativeHWNDHost")`), fragile entre versions de Windows |
| Notifications Windows | Exigent une identité de package et une autorisation de l'utilisateur ; elles conditionnent la distribution (voir C.4) |
| Hooks clavier et souris globaux | Pas nécessaires avec notre conception de fenêtre (D.6) ; risque de détection antivirus |
| Wi-Fi et Bluetooth (activer/désactiver) | P2 ; `Windows.Devices.Radios` est à valider hors package |
| Plugins tiers | P3 ; l'API interne doit d'abord se stabiliser sur nos propres modules |

### C.4 Faisabilité des fonctionnalités avec les API Windows

Légende : ✅ API publique et propre · ⚠️ possible avec des limites · ❌ pas d'API publique ou bricolage.

| Prio | Fonction | API / bibliothèque | Statut | Remarques |
|---|---|---|---|---|
| P1 | Fenêtre de l'île | Win32 : `WS_EX_NOACTIVATE`, `WS_EX_TOOLWINDOW`, `WS_EX_LAYERED`, `HWND_TOPMOST`, `SetWindowRgn` | ✅ | Le comportement de WebView2 au clic avec `NOACTIVATE` est **à valider à l'étape 1** (risque n°1) |
| P1 | Détection du plein écran | `SHQueryUserNotificationState` + `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` + comparaison rectangle fenêtre / rectangle moniteur | ✅ | Les jeux exclusifs, les vidéos en plein écran et les présentations sont détectables |
| P1 | Multi-écran et DPI | `EnumDisplayMonitors`, `GetDpiForMonitor`, `WM_DPICHANGED`, `WM_DISPLAYCHANGE` (Tauri expose le facteur d'échelle) | ✅ | Les broadcasts n'arrivent pas aux fenêtres « message-only » : il faut une fenêtre cachée de premier niveau |
| P1 | Veille, reprise, verrouillage | `WM_POWERBROADCAST`, `WTSRegisterSessionNotification` | ✅ | À la reprise : resynchroniser SMTC, remettre au premier plan, recalculer la position |
| P1 | Lecture en cours et contrôles | WinRT `GlobalSystemMediaTransportControlsSessionManager` (SMTC) | ⚠️ | Ne fonctionne qu'avec les applications qui publient sur SMTC (Spotify, Chrome, Edge, Firefox, lecteur Windows…). Certaines n'exposent ni la durée ni la pochette. Fonctionne sans package. |
| P1 | Pochette | SMTC `Thumbnail()` → flux → octets | ✅ | La servir par un protocole personnalisé Tauri plutôt qu'en base64 sur l'IPC |
| P1 | Volume | Core Audio `IAudioEndpointVolume` + `IAudioEndpointVolumeCallback` (événements) | ✅ | |
| P1 | Icône de notification | `tray-icon` de Tauri | ✅ | Recréer l'icône si `TaskbarCreated` (redémarrage d'Explorer) |
| P1 | Démarrage automatique | `tauri-plugin-autostart` (clé `Run` du registre) | ✅ | |
| P1 | Instance unique | `tauri-plugin-single-instance` | ✅ | |
| P1 | Raccourci global | `RegisterHotKey` (`tauri-plugin-global-shortcut`) | ✅ | Pas de hook clavier bas niveau |
| P2 | Luminosité | WMI `WmiMonitorBrightnessMethods` (écran interne) ; DDC/CI `dxva2` (externes) | ⚠️ | Le DDC/CI dépend de l'écran et peut être lent |
| P2 | Batterie | `GetSystemPowerStatus`, `Windows.Devices.Power.Battery` | ✅ | |
| P2 | Shelf | Dépôt OLE (géré par Tauri ou un `IDropTarget` maison) ; glisser vers l'extérieur avec `tauri-plugin-drag` | ⚠️ | Avec `dragDropEnabled` de Tauri, on reçoit les **chemins** mais pas le **texte** : un prototype dédié est nécessaire (étape P2-a) |
| P2 | Minuteur, Pomodoro | Aucune API système | ✅ | Logique dans le backend (survit à un rechargement de l'interface) |
| P2 | Visualiseur audio | WASAPI en boucle de retour + `rustfft` | ✅ | Coût CPU réel ; actif seulement si lecture **et** île visible |
| P2 | Exclusion des captures | `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` | ✅ | Windows 10 2004+ ; en option |
| P2 | Wi-Fi et Bluetooth (activer/désactiver) | `Windows.Devices.Radios` | ⚠️ | Accès hors package à valider ; sinon, ouvrir `ms-settings:` |
| P2 | Ne pas déranger | Aucune API publique pour l'activer | ❌ | On ne peut qu'ouvrir les réglages (Bloom a dû faire pareil) |
| P2 | Notifications | `UserNotificationListener` | ⚠️ | Exige une **identité de package** (MSIX ou package « sparse ») et l'accord de l'utilisateur ; non documenté explicitement, à confirmer par un test |
| P2 | Micro et caméra en cours d'utilisation | Registre `CapabilityAccessManager\ConsentStore` (`LastUsedTimeStop`) | ⚠️ | Semi-documenté |
| P2 | Paroles | Service tiers (ex. LRCLIB) | ⚠️ | Dépendance réseau ; vérifier les conditions d'utilisation |
| — | Remplacer l'OSD natif de volume | Aucune | ❌ | Exclu |

---

## D. Architecture recommandée

### D.1 Choix de la pile technique : comparaison

| Critère | **Tauri 2 + Rust + TS** | Rust natif + Direct2D/DirectComposition | WinUI 3 (C#) | WPF (C#) |
|---|---|---|---|---|
| Qualité et vitesse de mise au point des animations | ★★★ (Motion, CSS, devtools, rechargement à chaud) | ★ (tout est à écrire à la main) | ★★ (Composition API puissante mais verbeuse) | ★★ |
| RAM au repos | ★ (processus WebView2 : de l'ordre de 80 à 150 Mo d'après des sources tierces, **à mesurer**) | ★★★ (environ 10–30 Mo) | ★★ (runtime .NET plus WinAppSDK) | ★★ |
| CPU au repos | ★★ si piloté par événements | ★★★ | ★★ | ★★ |
| Fenêtre transparente, sans bordure, non activable | ★★ (prouvé par Bloom, avec du Win32) | ★★★ | ★ (transparence longtemps problématique ; meilleure avec WinAppSDK 2.0) | ★ (`AllowsTransparency` = fenêtre en couches, historiquement coûteuse) |
| Accès aux API Windows | ★★★ (crate `windows`, officielle Microsoft) | ★★★ | ★★★ | ★★★ |
| Maintenance, contributeurs | ★★★ | ★ | ★★ | ★★ |
| Distribution | ★★★ (NSIS/MSI, mise à jour signée, environ 5–10 Mo) | ★★★ | ★★ | ★★ |
| Référence existante | Bloom, dynamic-island | Mods Windhawk | — | WinIsland |

**Recommandation : Tauri 2 + Rust + React/TypeScript + Motion**, avec des **règles différentes de celles de Bloom** :

1. **Une seule WebView permanente** (l'île). La fenêtre des réglages est créée à l'ouverture et **détruite** à la fermeture.
2. **Fenêtre dimensionnée à la taille maximale de l'île** (environ 640 × 320 logiques plus la marge d'ombre), pas à toute la largeur de l'écran.
3. **Backend piloté par événements.** Aucune boucle de sondage permanente.
4. **Le backend est la source de vérité** pour les données système, les réglages et les minuteurs. L'interface n'est qu'une vue de l'état et l'animation de la pilule.
5. **Une porte de sortie.** Toute la logique système étant en Rust derrière une interface IPC typée, l'interface pourrait un jour être remplacée par un rendu natif sans tout réécrire.

**Pourquoi pas le natif pur ?** Ton objectif principal est la qualité des animations et de l'interface. Les mods Windhawk prouvent que c'est faisable en natif, mais au prix de milliers de lignes de dessin manuel pour chaque composant. Le surcoût mémoire de WebView2 est le compromis accepté. **Il sera mesuré à l'étape 1**, et si le résultat est inacceptable pour toi, c'est le moment de changer de pile, pas plus tard.

**Interface : React ou autre ?** React 19 + Motion (MIT) donne les ressorts interruptibles, `AnimatePresence`, `layout` et un écosystème connu. Solid ou Svelte seraient plus légers, mais l'écart de mémoire est négligeable face à WebView2. **Pas de Tailwind** : des variables CSS de design (« tokens ») et du CSS par composant suffisent et restent lisibles.

### D.2 Versions actuelles (relevées le 27 octobre 2026)

| Composant | Version | Licence |
|---|---|---|
| `tauri` | 2.12.5 | Apache-2.0 OR MIT |
| `@tauri-apps/api` | 2.12.4 | Apache-2.0 OR MIT |
| `windows` (crate) | 0.62.2 | MIT OR Apache-2.0 |
| `tauri-plugin-single-instance` | 2.5.4 | Apache-2.0 OR MIT |
| `tauri-plugin-autostart` | 2.7.0 | Apache-2.0 OR MIT |
| `tauri-plugin-updater` | 2.14.0 | Apache-2.0 OR MIT |
| `tauri-plugin-drag` | 2.1.1 | Apache-2.0 OR MIT |
| `rustfft` | 6.4.1 | MIT OR Apache-2.0 |
| `react` | 19.3.1 | MIT |
| `motion` | 14.7.1 | MIT |
| `vitest` | 5.0.5 | MIT |
| Icônes : `lucide-react` / `@phosphor-icons/react` | 1.62.0 / 2.1.10 | ISC / MIT |

Ta machine a déjà tout le nécessaire : Rust 1.96.1, Node 25.9, pnpm 10.33, bun 1.3, Git. Je propose **pnpm** comme gestionnaire de paquets.

### D.3 Structure des modules

```
/
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs              # démarrage, plugins, enregistrement des commandes
│  │  ├─ app/                 # cycle de vie : instance unique, tray, journal, panic hook, arrêt propre
│  │  ├─ island_window/       # création, styles Win32, région, position, choix d'écran, premier plan
│  │  │  ├─ styles.rs         # NOACTIVATE / TOOLWINDOW / LAYERED / TOPMOST
│  │  │  ├─ region.rs         # SetWindowRgn (rectangles → pixels physiques)
│  │  │  ├─ placement.rs      # géométrie pure, testable
│  │  │  └─ fullscreen.rs     # détection du plein écran
│  │  ├─ system_events/       # fenêtre cachée : affichage, alimentation, session, TaskbarCreated
│  │  ├─ media/               # SMTC piloté par événements, pochette via protocole perso
│  │  ├─ audio/               # volume (callback), plus tard visualiseur
│  │  ├─ settings/            # struct typée, versionnée, écriture atomique, migrations
│  │  └─ ipc.rs               # types partagés commandes et événements
│  └─ tauri.conf.json
├─ src/
│  ├─ island/                 # coquille de la pilule : géométrie, ressorts, synchro de région
│  ├─ machine/                # machine à états pure (+ tests)
│  ├─ modules/                # un dossier par module : media/, peek-volume/, plus tard shelf/, timer/
│  ├─ ipc/                    # client typé (invoke/listen)
│  ├─ settings-window/        # point d'entrée séparé, chargé à la demande
│  └─ styles/tokens.css       # couleurs, rayons, espacements, typo
└─ docs/
```

**Typage de l'IPC.** Les types Rust sont exportés vers TypeScript avec `ts-rs` ou `tauri-specta`. Le choix se fera à l'étape 0, selon leur maturité à ce moment-là.

### D.4 La pilule et ses états

**Principe clé : la transition n'est pas un état.** Si on modélise « en transition », on retrouve les animations contradictoires : que faire d'un clic pendant la transition ? La machine à états produit à la place une **cible** (forme et contenu). La couche d'animation poursuit cette cible avec des ressorts **interruptibles** qui conservent leur vitesse. Une transition interrompue repart naturellement vers la nouvelle cible.

**Trois couches orthogonales :**

```
Présence  : hidden ─────────── visible
              (plein écran, réglage, pas d'écran)
Surface   : idle ─ activity ─ peek ─ expanded
Contenu   : quel module occupe la surface (choisi par un arbitre à priorités)
```

| Surface | Quand | Sortie |
|---|---|---|
| `idle` | Rien à montrer | Survol → `idle` + `hover` (légère croissance) ; clic → `expanded` |
| `activity` | Une activité persistante existe (média en lecture, minuteur actif) | Fin de l'activité → `idle` |
| `peek` | Événement ponctuel (piste suivante, volume) | Délai écoulé (env. 2,2 s, prolongé si survol) → état précédent |
| `expanded` | Clic, ou survol prolongé si l'option est active | Sortie du curseur + délai de grâce, `Échap`, clic sur l'île repliée |

`hover` est un **modificateur** (booléen dans le contexte), pas une surface : il agrandit légèrement la pilule quel que soit son état.

**L'arbitre d'activités.** Chaque module publie des **activités** avec une priorité (`alert` > `peek` > `live` > `ambient`). L'arbitre décide quel module occupe la surface : une seule règle, au lieu de conditions croisées. Si deux activités `live` coexistent (musique et minuteur), la secondaire devient une **pastille** à côté de la pilule (une idée de Bloom, avec ses « activity bubbles »).

**Contrat d'un module** (base de la future API de plugins) :

```ts
interface IslandModule {
  id: string;
  views: {
    activity?: { size: Size; render: () => JSX.Element };   // pilule compacte enrichie
    peek?:     { size: Size; render: (e: PeekEvent) => JSX.Element };
    expanded?: { size: Size | (() => Size); render: () => JSX.Element };
  };
  subscribe(ctx: ModuleContext): Unsubscribe;   // reçoit les événements backend, publie des activités
}
```

La géométrie de la pilule vient de `(surface, module actif)` : chaque module déclare ses tailles. Il n'y a **pas** de `getDynamicHeight()` central avec un `if` par mode.

**Implémentation.** Une fonction de transition pure `(state, event) → state`, écrite à la main en TypeScript (environ 150–250 lignes) et testée exhaustivement avec Vitest. XState (MIT) reste une option si la machine grossit, mais il n'est pas nécessaire au départ.

### D.5 Système d'animation

- **Une seule surface physique** : un élément positionné en absolu, `contain: layout paint`, `will-change: width, height`. Il anime `width`, `height` et `border-radius` par ressort (Motion).
- Le **contenu** change par opacité, translation et flou léger. Ce sont des propriétés gérées par le compositeur, donc bon marché.
- **Ressorts nommés** dans un seul fichier (`src/island/springs.ts`), jamais en ligne dans les composants. Voir F.4.
- **Interruption** : Motion reprend avec la vitesse courante. La règle : on ne lance jamais une animation « à partir de » une valeur figée.
- **Région synchronisée sur la cible**, pas sur la taille animée. Elle grandit immédiatement et rétrécit après stabilisation : on reprend l'idée de Bloom, réimplémentée indépendamment.
- **Mode lent** dans les réglages développeur (×0,25) et **superposition de débogage** (contour de la région, état courant, FPS).
- **Mouvements réduits** : respecter `prefers-reduced-motion`. WebView2 reflète *a priori* le réglage Windows « Effets d'animation », à vérifier. Dans ce mode, les ressorts sont remplacés par des fondus de 120 ms.
- **Le coût de `width`/`height`** (mise en page à chaque image) est à mesurer à l'étape 2. Si c'est trop lourd, l'alternative est une forme en `clip-path: inset(… round r)` sur un calque de taille maximale.

### D.6 Fenêtre, focus, clics

**Configuration de la fenêtre :**

- `decorations: false`, `transparent: true`, `shadow: false`, `skipTaskbar: true`, `focus: false`, `alwaysOnTop: true`.
- Puis en Win32 : `WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW | WS_EX_LAYERED`. Ces styles sont réappliqués après chaque remise au premier plan.

**Clics.** La région de fenêtre (`SetWindowRgn`) correspond à la **cible** de la pilule, plus 8 px de marge pour l'ombre et l'hystérésis. Hors de cette région, les clics passent aux fenêtres du dessous, sans hook global. Le glisser-déposer OLE fonctionne, puisque la fenêtre n'est pas `WS_EX_TRANSPARENT`.

**Survol.** Les `pointerenter`/`pointerleave` du DOM suffisent quand la région couvre la pilule. Pour éviter le scintillement :

- délai d'intention de 120 ms à l'entrée ;
- délai de grâce de 350 ms à la sortie ;
- région légèrement plus grande que la pilule visible ;
- aucun changement de région pendant qu'une animation de rétrécissement est en cours.

**Mode « révéler au bord »** (île masquée, apparaît quand le curseur touche le haut de l'écran) : une bande de 2 px reste dans la région quand l'île est masquée. Si cela pose problème (onglets de navigateur en plein écran), on passera à un sondage `GetCursorPos` **seulement dans ce mode**. Pas de `WH_MOUSE_LL`.

**Focus clavier.** Par défaut, l'île ne prend jamais le focus. Si un module a besoin d'une saisie (P2 : renommer un élément du Shelf, une tâche), il demande explicitement le focus. On retire alors temporairement `NOACTIVATE` et on appelle `SetForegroundWindow`, puis on restaure à la perte du focus. **Risque à valider à l'étape 1** : le comportement de la WebView2 enfant au clic sous `NOACTIVATE`.

**Plein écran.** Sur `EVENT_SYSTEM_FOREGROUND` et au changement de position de la fenêtre au premier plan, on évalue l'état. Si l'application au premier plan est en plein écran sur le moniteur de l'île, on passe en `hidden`, ce qui vide la région. C'est désactivable.

**Multi-écran.** Le réglage `display` accepte `primary`, un moniteur précis (identifié par son chemin de périphérique) ou `cursor` (P2). Sur `WM_DISPLAYCHANGE` ou `WM_DPICHANGED`, on recalcule. Si le moniteur choisi disparaît, on se replie sur le moniteur principal.

**Robustesse :**

- Un crash du processus fait disparaître la fenêtre : rien à restaurer, puisqu'on ne touche pas à la barre des tâches.
- Une WebView2 qui ne répond plus (`ProcessFailed`) est rechargée. Au-delà de 3 échecs en 60 s, on quitte proprement et on l'écrit dans le journal.
- Un `panic` Rust est journalisé dans `%LOCALAPPDATA%\<app>\logs`.

### D.7 Communication entre interface et backend

| Sens | Mécanisme | Usage |
|---|---|---|
| Interface → backend | `invoke` (commandes typées) | Actions : lecture/pause, réglages, demande de focus, envoi de la région |
| Backend → interface | Événements Tauri | `media://state`, `audio://volume`, `presence://changed`, `settings://changed` |
| Flux volumineux | Protocole personnalisé (`island-asset://art/<hash>`) | Pochettes, miniatures du Shelf ; pas de base64 sur l'IPC |
| Données haute fréquence (P2, visualiseur) | `tauri::ipc::Channel` | 30–60 messages/s, seulement quand c'est visible |

**Threads.** Les API WinRT et COM tournent dans des workers dédiés (MTA), jamais sur le thread principal de Tauri. Chaque worker publie dans un canal qui émet vers l'interface.

**Resynchronisation.** Après un rechargement de l'interface ou une reprise de veille, l'interface demande un **instantané** (`get_snapshot`) puis écoute les événements. On ne suppose jamais qu'on n'a rien manqué.

### D.8 Persistance des réglages

- Fichier `%APPDATA%\<app>\settings.json`.
- Une `struct Settings` serde **typée**, avec un champ `version` et des migrations.
- Écriture atomique (fichier temporaire puis renommage) et sérialisée (un seul propriétaire, le backend).
- Un fichier corrompu est **conservé** (`settings.corrupt-<date>.json`) et remplacé par les valeurs par défaut, avec un message à l'utilisateur.
- L'interface ne lit pas `localStorage` pour les réglages. Elle reçoit l'instantané et les événements `settings://changed`.
- `localStorage` est réservé aux préférences purement locales à l'interface (dernier onglet ouvert des réglages).

### D.9 Tests et distribution

**Tests :**

| Niveau | Outil | Ce qui est testé |
|---|---|---|
| Logique pure TS | Vitest | Machine à états, arbitre d'activités, géométrie, synchro de région |
| Logique pure Rust | `cargo test` | Placement et DPI, conversion de régions, migrations de réglages, mapping SMTC → état |
| Intégration | Interface sur un **backend simulé** (mode `?mock`) | Tous les états visuels sans dépendre de Spotify |
| Système | **Liste de vérification manuelle** versionnée (`docs/checklists/`) | Focus, clics, plein écran, DPI, veille ; ces comportements ne s'automatisent pas de façon fiable |
| Performance | Gestionnaire des tâches et Performance Monitor (`typeperf`) | RAM (somme des processus WebView2 compris), CPU au repos sur 10 min, CPU pendant l'animation |
| CI | GitHub Actions `windows-latest` | `pnpm build` (typecheck), `vitest`, `cargo clippy -D warnings`, `cargo test` |

**Distribution :**

- Installeur NSIS (Tauri) en mode utilisateur, sans droits administrateur, plus un ZIP portable.
- Mises à jour signées avec `tauri-plugin-updater` (après le MVP).
- Plus tard : winget.
- **Signature de code** : sans signature, attendre des avertissements SmartScreen et Defender (Bloom en documente dans son README). Options :
  - SignPath Foundation : gratuit pour l'open source, sous conditions ;
  - Azure Trusted Signing : payant ;
  - ne rien signer au début.

  C'est une décision à prendre avant la première version publique.
- **MSIX** à étudier pour P2 si les notifications Windows deviennent un objectif, car elles exigent une identité de package.

---

## E. Plan de développement

Chaque étape se termine par une application **qui se lance**, des tests qui passent et la liste de vérification de l'étape cochée. Je ne passe à l'étape suivante qu'après ta validation.

### Étape 0 : Squelette (≈ ½ journée)

- **Fichiers** : `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src-tauri/{Cargo.toml, tauri.conf.json, build.rs, src/main.rs, capabilities/default.json}`, `.github/workflows/ci.yml`, `LICENSE`, `README.md`, `.gitignore`. On initialise aussi le dépôt Git.
- **Résultat** : `pnpm tauri dev` ouvre une fenêtre de test ; la CI est verte.
- **Tests** : `pnpm build`, `cargo clippy`, `cargo test` et un `vitest` de démonstration passent.

### Étape 1 : La fenêtre de l'île (≈ 1–2 jours) ⚠️ étape décisive

- **Fichiers** : `src-tauri/src/island_window/{mod, styles, placement, region}.rs`, `src-tauri/src/app/{tray, single_instance, logging}.rs`, `src/island/Island.tsx` (une pilule statique de 140 × 32, sans animation).
- **Résultat** :
  - fenêtre transparente en haut au centre du moniteur principal, sans entrée dans la barre des tâches ni dans Alt+Tab ;
  - région limitée à la pilule ;
  - icône de notification avec « Quitter » ;
  - seconde instance refusée.
- **Tests** :
  - **automatisés** : `placement.rs` (centrage, DPI 100/125/150/175 %, moniteurs à coordonnées négatives), conversion de régions ;
  - **manuels** : (a) taper dans le Bloc-notes, cliquer sur la pilule : le curseur de saisie reste dans le Bloc-notes ; (b) cliquer juste à côté de la pilule : le clic atteint la fenêtre du dessous ; (c) changer l'échelle Windows en direct ; (d) **mesurer la RAM et le CPU au repos**.
- **Point de décision** : si la RAM ou le comportement du focus sont inacceptables, on réévalue la pile **ici**.

### Étape 2 : Machine à états et animations (≈ 2–3 jours)

- **Fichiers** :
  - `src/machine/{island-machine.ts, island-machine.test.ts, arbiter.ts, arbiter.test.ts}` ;
  - `src/island/{springs.ts, geometry.ts, region-sync.ts, region-sync.test.ts, IslandShell.tsx}` ;
  - `src/styles/tokens.css` ;
  - `src/dev/DebugPanel.tsx`, présent seulement en développement : il déclenche les événements, affiche l'état, active le mode lent et montre le contour de la région.
- **Résultat** : les états idle, hover, peek et expanded fonctionnent avec un contenu factice. Les ressorts sont interruptibles. La région suit la cible avec rétention.
- **Tests** :
  - **Vitest** : chaque transition, chaque priorité de l'arbitre, la rétention de la région ;
  - **manuel** : 20 entrées et sorties rapides au survol sans scintillement ni blocage ; inverser un clic au milieu d'une ouverture ; vérifier 60 i/s dans le profil de performance de WebView2 (devtools).

### Étape 3 : Robustesse système (≈ 2 jours)

- **Fichiers** : `src-tauri/src/system_events/{mod, display, power, session}.rs`, `island_window/fullscreen.rs`, récupération WebView2, `docs/checklists/systeme.md`.
- **Résultat** : l'île se masque en plein écran (F11 dans un navigateur, vidéo, jeu), suit les changements d'écran et d'échelle, se rétablit après veille et verrouillage, survit au redémarrage d'Explorer et au crash du moteur de rendu.
- **Tests** : `cargo test` sur la logique de décision du plein écran (entrées : rectangles et état). Liste de vérification manuelle : débrancher ou rebrancher un écran, Win+L, mise en veille, `taskkill /f /im explorer.exe`, tuer `msedgewebview2.exe`.

### Étape 4 : Module média (≈ 3 jours)

- **Fichiers** : `src-tauri/src/media/{mod, smtc_worker, artwork_protocol, model}.rs`, `src/modules/media/{index.ts, MediaActivity.tsx, MediaPeek.tsx, MediaExpanded.tsx, progress.ts, progress.test.ts}`.
- **Résultat** :
  - activité compacte : pochette et barres d'activité ;
  - aperçu au changement de piste ;
  - lecteur développé : pochette, titre, artiste, progression interpolée localement, précédent/lecture/suivant ;
  - couleur d'accent extraite de la pochette.
- **Tests** : correspondance SMTC → modèle (Rust) ; interpolation de la progression (Vitest). Manuel avec Spotify, YouTube dans Chrome et Edge, le lecteur multimédia Windows, et le cas sans aucune source. CPU au repos inchangé avec de la musique en pause.

### Étape 5 : Réglages, persistance, démarrage auto (≈ 2 jours)

- **Fichiers** : `src-tauri/src/settings/{mod, schema, migrate, store}.rs`, `src/settings-window/*`, `src/ipc/settings.ts`.
- **Résultat** : fenêtre de réglages créée à la demande. On y règle la taille, le style (flottant ou accolé), l'écran, le masquage en plein écran, l'ouverture au survol, le démarrage automatique et la réduction des animations. Les changements s'appliquent à chaud.
- **Tests** : migrations, fichier corrompu, écritures concurrentes (Rust). Manuel : redémarrer la session et vérifier le démarrage automatique.

### Étape 6 : Contrôles rapides et aperçus système (≈ 2 jours)

- **Fichiers** : `src-tauri/src/audio/volume.rs`, `src-tauri/src/power/battery.rs`, `src/modules/{volume-peek, quick-controls}/*`.
- **Résultat** : un aperçu sur changement de volume (l'OSD natif reste affiché, c'est assumé) ; un panneau de contrôles rapides avec volume, sortie audio et raccourcis `ms-settings:` ; la batterie.
- **Tests** : le callback de volume ne s'exécute qu'à chaque changement, pas en continu. Manuel : touches multimédia du clavier, changement de casque.

### Étape 7 : Version 0.1 (≈ 1–2 jours)

- **Fichiers** : `.github/workflows/release.yml`, configuration du bundle NSIS, `CHANGELOG.md`, `docs/checklists/release.md`.
- **Résultat** : un installeur téléchargeable depuis GitHub Releases.
- **Tests** : installation et désinstallation sur un compte Windows propre ; aucune trace laissée sauf, en option, les réglages.

### Ensuite (P2, dans l'ordre proposé)

1. **Shelf** :
   - (a) prototype du dépôt de fichiers **et** de texte ;
   - (b) stockage par références avec revalidation (comme Boring Notch) ;
   - (c) glisser vers l'extérieur ;
   - (d) aperçus.
2. **Minuteur et Pomodoro**, gérés par le backend, avec une activité `live` et une pastille secondaire.
3. **Visualiseur audio réel** (WASAPI + FFT), actif seulement s'il y a lecture et que l'île est visible.
4. **Personnalisation** : thèmes, intensité des ressorts, style accolé ou flottant.
5. **Exclusion des captures, luminosité, indicateurs micro et caméra.**
6. **Étude MSIX et notifications.**

### Plus tard (P3)

- API de modules documentée (`docs/modules.md`), basée sur le contrat de D.4.
- Chargement de modules tiers : d'abord des modules web « déclaratifs » isolés, sans accès direct au backend, avec des permissions déclarées.
- Intégrations tierces.

---

## F. Direction artistique

### F.1 Principes

1. **Une matière, pas un effet.** Un noir profond mat et une seule ligne de lumière très fine. Pas de verre dépoli générique, pas de dégradé décoratif.
2. **La forme parle avant le contenu.** La silhouette annonce ce qui arrive, le contenu suit (décalage de 40 à 60 ms).
3. **On ouvre avec du ressort, on ferme avec calme.** C'est la leçon de Boring Notch.
4. **La couleur vient du contenu.** L'interface est neutre ; l'accent vient de la pochette (désaturé, luminance bornée) ou de l'état (minuteur).
5. **Grille de 4 px**, alignements optiques, chiffres tabulaires.

### F.2 Matière et couleurs (tokens de départ)

| Token | Valeur | Usage |
|---|---|---|
| `--surface` | `#0A0A0B` | Fond de la pilule (quasi noir, propre sur un écran OLED) |
| `--surface-raised` | `#141416` | Boutons au survol, tuiles |
| `--hairline` | `rgba(255,255,255,0.07)` | Liseré intérieur de 1 px en haut seulement : donne l'épaisseur sans effet de verre |
| `--text-1` | `#F3F3F4` | Titre |
| `--text-2` | `rgba(243,243,244,0.58)` | Artiste, métadonnées |
| `--text-3` | `rgba(243,243,244,0.34)` | Durées, indices |
| `--accent` | dynamique, sinon `#E8B86A` (ambre doux) | Progression, visualiseur, état actif |
| `--danger` | `#FF6B5E` | Enregistrement, alertes |
| Ombre | `0 8px 24px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.6)` | Seulement à l'état développé ; l'état compact n'a quasiment pas d'ombre |

**Typographie.** *Segoe UI Variable*, la police système de Windows 11 (on ne la redistribue pas, donc aucun souci de licence). On utilise *Display* pour les titres de 15 px et plus, *Text* en dessous, `font-variant-numeric: tabular-nums` pour les durées. Sous Windows 10, repli sur *Segoe UI*.

**Tailles** : titre 14/600, sous-titre 12/400, micro 11/500 avec 0,2 px d'espacement.

**Icônes.** Phosphor (MIT) ou Lucide (ISC), avec un trait de 1,75 px. Les quatre glyphes média (lecture, pause, précédent, suivant) sont dessinés par nous, pleins et optiquement centrés. **Jamais de SF Symbols** (voir G).

### F.3 États et dimensions à tester (pixels logiques à 100 %)

Deux styles : **Flottant** (par défaut, à 8 px du haut, pilule entièrement arrondie) et **Accolé** (collé au bord haut, coins supérieurs remplacés par des évasements concaves de 8 px, l'esprit de `NotchShape`).

| État | Taille (L × H) | Rayon | Contenu |
|---|---|---|---|
| `hidden` | — | — | Translation de −(H + 12) px et opacité 0 ; ou rétrécissement à 60 % puis fondu, selon le style |
| `idle` | 128 × 30 | 15 | Vide, ou un point d'état de 4 px (ex. batterie faible) |
| `idle` + survol | 136 × 32 | 16 | Croissance de 6 % : « je t'ai vu » |
| `activity` (média) | 232 × 32 | 16 | À gauche, pochette 20 × 20 (rayon 6) ; à droite, 4 barres de 3 px |
| `peek` (piste, volume) | 340 × 48 | 24 | Pochette 32 × 32 (rayon 8), titre et artiste sur une ligne, défilement si nécessaire |
| `expanded` (média) | 420 × 176 | 32 | Pochette 88 × 88 (rayon 14), titre et artiste, progression, 3 commandes de 36 px |
| `expanded` (contrôles) | 420 × 200 | 32 | Grille de tuiles 2 × 3 et curseur de volume |
| Maximum de fenêtre | 640 × 320 + 24 de marge | — | Taille de la fenêtre Win32 |

Marges intérieures de l'état développé : 16 px, et 12 px entre les blocs. Le **rayon suit la hauteur** (min(H/2, 32)) pour garder la sensation de « pilule qui s'étire ».

### F.4 Mouvement (tokens initiaux, à affiner avec le mode lent)

Exprimés avec la notation Motion (`visualDuration`, `bounce`), plus lisible que raideur/amortissement :

| Nom | Valeur | Usage |
|---|---|---|
| `morph.open` | `visualDuration 0.40, bounce 0.18` | Croissance de la pilule (largeur, hauteur, rayon) |
| `morph.close` | `visualDuration 0.34, bounce 0` | Repli sans dépassement |
| `morph.hover` | `visualDuration 0.22, bounce 0.10` | Croissance de 6 % au survol |
| `content.in` | 160 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)` ; opacité 0→1, `y` 4→0, flou 4→0 px ; **délai 60 ms** | Le contenu arrive après la forme |
| `content.out` | 90 ms, linéaire ; opacité 1→0, échelle 1→0,98 | Le contenu part avant la forme |
| `press` | échelle 0,96, `visualDuration 0.15, bounce 0.3` | Boutons |
| `peek.hold` | 2 200 ms (prolongé si survol) | Durée d'un aperçu |

**Chorégraphie d'une ouverture (idle → expanded) :**

| Temps | Ce qui se passe |
|---|---|
| 0 ms | La région s'agrandit, le ressort `morph.open` démarre, le contenu compact sort (90 ms) |
| ≈ 60–100 ms | Le contenu développé entre en décalé : pochette, puis texte, puis commandes, à 30 ms d'intervalle |
| ≈ 400 ms | La forme se stabilise |

Le repli fait l'inverse, sans décalage, avec `morph.close`.

**Entre deux modules en état développé** (média → contrôles) : la forme change de taille par ressort, le contenu fait un fondu enchaîné avec un léger glissement horizontal de 8 px, dans le sens de navigation.

### F.5 Interactions

| Geste | Effet |
|---|---|
| Survol de 120 ms | `hover` (+6 %), et ouverture après 450 ms si « ouvrir au survol » est actif (désactivé par défaut) |
| Clic sur la pilule | `expanded` sur le module prioritaire |
| Sortie du curseur | Fermeture après 350 ms de grâce ; annulée si le curseur revient |
| Molette ou glissement horizontal à l'état développé | Module suivant ou précédent |
| Clic droit | Menu natif : réglages, épingler ouvert, masquer 1 h, quitter |
| `Échap` (si l'île a le focus) | Fermer |
| Raccourci global (configurable) | Ouvrir/fermer, avec le focus clavier donné à l'île |

### F.6 À éviter explicitement

- Verre dépoli sur toute la pilule, néons, dégradés d'arc-en-ciel.
- Rebonds sur la fermeture, et animations de plus de 500 ms.
- Contenu qui s'anime **avant** que la forme ait commencé à bouger.
- Boutons système standard ou cases à cocher natives dans l'île.
- Plus de deux niveaux de texte dans un même bloc.

---

## G. Licences : ce qu'on peut faire et ce qu'on ne peut pas faire

### G.1 Statut des sources

| Source | Licence | Réutiliser le code ? |
|---|---|---|
| Bloom | **GPL-3.0-only** | Seulement si notre projet est distribué sous GPL-3.0. Obligations : fournir le code source correspondant avec chaque binaire (l'installeur compris), conserver les mentions de copyright et de licence, indiquer les modifications, ne pas ajouter de restriction. « Only » interdit de passer à une future GPL-4.0. |
| Boring Notch | GPL-3.0 | Même règle ; de toute façon, c'est du Swift, sans intérêt direct pour nous |
| `NotchShape` (DynamicNotchKit) | MIT | Possible avec la mention MIT, mais l'idée (courbes quadratiques, rayons animables) se réimplémente en 20 lignes |
| WinIsland | **Aucune licence** = tous droits réservés | **Non.** Lecture seulement |
| DynamicWin | CC BY-SA 4.0, sans code | Rien à réutiliser |
| Windhawk « Dynamic Island for Windows », « Island Media Controls », « Taskbar Music Lounge » | MIT | Possible avec attribution |
| Windhawk « Mac Island & Dock » | GPL-3.0 | Comme Bloom |
| dynamic-island (thanvish21) | MIT | Possible avec attribution |
| Notchify | Propriétaire | Non (et aucun code disponible) |

### G.2 Inspiration et copie

- **Libre, car ce ne sont pas des œuvres protégées :**
  - les idées et comportements : région calée sur la cible, rétention lors du rétrécissement, ressort plus doux à la fermeture, intention de survol, pastilles d'activité, Shelf par références ;
  - les choix d'API Windows ;
  - les valeurs de réglage, réécrites et ajustées par nous.

  On les **réimplémente** sans copier-coller.
- **Code** : rien n'est copié dans ce projet sans (1) vérification de la licence du fichier, (2) mention dans `THIRD_PARTY_NOTICES.md` et (3) compatibilité avec notre licence.
- **Ressources graphiques** :
  - `bloom/src/icons/sf/*.svg` sont des **SF Symbols d'Apple**, dont la licence limite l'usage aux applications des plateformes Apple : ne pas les reprendre ;
  - pas d'icône ni de logo de Bloom, Boring Notch ou Notchify ;
  - polices : Segoe UI Variable est fournie par le système (non redistribuée) ; toute police embarquée doit être sous OFL.
- **Marques** :
  - « Dynamic Island » est une marque d'Apple : à éviter dans le nom du produit et dans les visuels promotionnels ;
  - « Notchify » et « Bloom » sont des noms déjà pris ;
  - « île » ou « island » en description générique ne pose pas de problème.

### G.3 Licence du projet : décision à prendre

| Option | Pour | Contre |
|---|---|---|
| **GPL-3.0-or-later** (recommandée) | Garantit que les dérivés restent libres ; permet d'intégrer légalement du code de Bloom ou de Mac Island & Dock si un jour c'est utile ; cohérent avec l'écosystème de référence | Moins attrayant pour une réutilisation commerciale par des tiers |
| MIT ou Apache-2.0 | Adoption maximale | Interdit d'intégrer le moindre fragment GPL : implémentation entièrement « propre », sans copie, à tenir avec rigueur |

Toutes les dépendances proposées en D.2 (MIT, Apache-2.0, ISC) sont compatibles avec les deux options.

---

## H. Risques principaux

| # | Risque | Probabilité | Mitigation | Validé à |
|---|---|---|---|---|
| 1 | La WebView2 prend le focus au clic malgré `WS_EX_NOACTIVATE` | Moyenne | Bloom montre que c'est maîtrisable (réapplication des styles) ; sinon, retour au focus précédent sur `WM_ACTIVATE` | Étape 1 |
| 2 | RAM de WebView2 jugée trop élevée | Moyenne | Une seule WebView, réglages détruits à la fermeture, niveau mémoire bas de WebView2 au repos ; sinon, changer de pile **à l'étape 1** | Étape 1 |
| 3 | Animer `width`/`height` provoque des saccades | Faible à moyenne | `contain`, contenu en `transform`/opacité, sinon alternative `clip-path` | Étape 2 |
| 4 | Scintillement au survol en bordure | Moyenne | Hystérésis, rétention de région, délais d'intention et de grâce, tests de 20 allers-retours | Étape 2 |
| 5 | Applications média mal intégrées à SMTC | Certaine (partiellement) | Afficher ce qui est disponible, ne jamais planter sur un champ vide ; documenter les applications compatibles | Étape 4 |
| 6 | Avertissements SmartScreen et Defender | Élevée sans signature | Pas de hooks globaux, build reproductible, signature (G.3, D.9) | Étape 7 |

---

## I. Ce que je te demande de valider avant l'étape 0

1. **La pile** : Tauri 2 + Rust + React/TypeScript + Motion, avec le point de décision sur la RAM et le focus à l'étape 1.
2. **La licence** : GPL-3.0-or-later ou MIT/Apache-2.0.
3. **Le périmètre du MVP** (C.3), en particulier : pas de dock, pas de notifications, pas de masquage de l'OSD natif.
4. **La cible de version** : Windows 11 en priorité, Windows 10 22H2 « au mieux » (Windows 10 n'est plus supporté par Microsoft depuis octobre 2025).
5. **Le style par défaut** : Flottant ou Accolé.
6. **Le nom** : l'éventuel nom de code pour le dépôt (on pourra le changer).

---

### Sources consultées

- Bloom : https://github.com/SehajveerSingh2005/bloom (clone, révision `fa32e83`)
- Boring Notch : https://github.com/TheBoredTeam/boring.notch (clone, révision `23e7705`)
- Notchify : https://notchify.app/
- WinIsland : https://github.com/lb-li/WinIsland
- DynamicWin : https://github.com/FlorianButz/DynamicWin
- dynamic-island : https://github.com/thanvish21/dynamic-island
- Mods Windhawk : https://github.com/ramensoftware/windhawk-mods (`mods/dynamic-island-for-windows.wh.cpp`, `island-media-controls.wh.cpp`, `mac-island-dock.wh.cpp`, `taskbar-music-lounge.wh.cpp`)
- DynamicNotchKit (licence MIT via l'API GitHub) : https://github.com/MrKai77/DynamicNotchKit
- Performance de WebView2 : https://learn.microsoft.com/microsoft-edge/webview2/concepts/performance
- Mémoire de Tauri et WebView2 (tiers, non vérifié) : https://github.com/tauri-apps/tauri/issues/5889
- Paramètre de cible mémoire WebView2 dans wry : https://v2.tauri.app/fr/release/wry/v0.35.0/
- Transparence WinUI 3 : https://learn.microsoft.com/en-sg/answers/questions/1463839/how-to-make-winui-3-window-transparent
- Identité de package et API Windows : https://learn.microsoft.com/windows/apps/desktop/modernize/modernize-packaged-apps
- Versions et licences des dépendances : API crates.io et registre npm, relevés le 27 octobre 2026
