/**
 * The guides beyond AI agents: what Quiera does for everyone, and what people
 * look for on Windows around it. Same shape as src/guides.ts.
 */
import type { Guide } from "./guides";

const Q = "[Quiera](https://quiera.eu)";
const QEN = "[Quiera](https://quiera.eu/en/)";

export const MORE_GUIDES: Guide[] = [
  /* ------------------------------------------------------------ Dynamic Island */
  {
    slug: "dynamic-island-windows",
    category: "island",
    updated: "2026-11-08",
    related: ["best-dynamic-island-windows", "free-dynamic-island-windows-11", "spotify-lyrics-pc"],
    fr: {
      slug: "dynamic-island-windows",
      title: "Avoir la Dynamic Island de l'iPhone sur Windows",
      description: "La Dynamic Island, c'est quoi, et comment en avoir une sur un PC Windows 11 : ce qu'elle affiche, comment l'installer, et ce qu'elle coûte en ressources.",
      intro: "Sur iPhone, la Dynamic Island est la pilule noire en haut de l'écran qui grandit pour montrer la musique, un minuteur ou un appel. Sur Windows, des applis reproduisent l'idée en haut du bureau.",
      blocks: [
        {
          h2: "Ce qu'une Dynamic Island apporte sur PC",
          list: [
            "La **musique en cours** et ses paroles, sans ouvrir Spotify.",
            "Des **aperçus** discrets : chargeur branché, casque connecté, volume, Verr. Maj.",
            "Tes **notifications**, ta **prochaine réunion** et un **minuteur**, toujours au même endroit.",
            "Un **lanceur** façon Spotlight pour ouvrir une appli ou un fichier au clavier.",
          ],
        },
        {
          h2: "Installer Quiera",
          steps: [
            "Télécharge l'installateur sur [quiera.eu](https://quiera.eu).",
            "Lance-le : si Windows affiche « Windows a protégé votre ordinateur », clique sur « Informations complémentaires », puis « Exécuter quand même » (l'installateur n'est pas encore signé).",
            "L'île apparaît en haut de l'écran. Survole-la pour l'ouvrir ; Alt+Espace ouvre le lanceur.",
          ],
        },
        {
          h2: "Et les performances ?",
          p: [
            "Une île doit rester légère : " + Q + " utilise quelques millisecondes de processeur par seconde au repos, réduit sa mémoire dès qu'elle se referme, et se cache en plein écran (jeux, vidéos).",
          ],
        },
      ],
    },
    en: {
      title: "Get the iPhone's Dynamic Island on Windows",
      description: "What the Dynamic Island is, and how to get one on a Windows 11 PC: what it shows, how to install it, and what it costs in resources.",
      intro: "On iPhone, the Dynamic Island is the black pill at the top of the screen that grows to show music, a timer or a call. On Windows, apps bring the same idea to the top of the desktop.",
      blocks: [
        {
          h2: "What a Dynamic Island brings to a PC",
          list: [
            "The **music playing** and its lyrics, without opening Spotify.",
            "Discreet **peeks**: charger plugged in, headphones connected, volume, Caps Lock.",
            "Your **notifications**, your **next meeting** and a **timer**, always in the same place.",
            "A Spotlight-style **launcher** to open an app or a file from the keyboard.",
          ],
        },
        {
          h2: "Install Quiera",
          steps: [
            "Download the installer from [quiera.eu](https://quiera.eu/en/).",
            "Run it: if Windows says “Windows protected your PC”, click “More info”, then “Run anyway” (the installer isn't signed yet).",
            "The island appears at the top of the screen. Hover it to open it; Alt+Space opens the launcher.",
          ],
        },
        {
          h2: "What about performance?",
          p: [
            "An island must stay light: " + QEN + " uses a few milliseconds of CPU per second at rest, trims its memory as soon as it closes, and hides in fullscreen (games, videos).",
          ],
        },
      ],
    },
  },
  {
    slug: "best-dynamic-island-windows",
    category: "island",
    updated: "2026-11-08",
    related: ["dynamic-island-windows", "free-dynamic-island-windows-11", "notchnook-alternative-windows"],
    fr: {
      slug: "meilleures-dynamic-island-windows",
      title: "Les meilleures Dynamic Island pour Windows (comparatif 2026)",
      description: "DynamicWin, Notchify, Isle, Tomte, WinIsland, Dynamic Edge, Quiera : les applis qui ajoutent une Dynamic Island à Windows, ce que fait chacune, et laquelle choisir.",
      intro: "Depuis l'arrivée de la Dynamic Island sur iPhone, une dizaine d'applis l'ont adaptée à Windows. Voici les principales, d'après les pages de leurs auteurs et la presse (relevé en novembre 2026).",
      blocks: [
        {
          h2: "Ce qui les distingue",
          list: [
            "**Ce qu'elles affichent** : seulement la musique, ou aussi les notifications, l'agenda, les fichiers, les agents IA.",
            "**Leur discrétion** : toujours visibles, ou cachées jusqu'à ce que la souris s'approche, et effacées en plein écran.",
            "**Leur prix et leur code** : gratuites ou payantes, open source ou fermées.",
            "**Leur poids** sur le processeur et la mémoire.",
          ],
        },
        {
          h2: "Les applis",
          list: [
            "**[Quiera](https://quiera.eu)** (gratuit, open source) : musique avec paroles synchronisées mot à mot, lanceur façon Spotlight, notifications, agenda avec bouton Rejoindre, minuteur, contrôles du son, du Wi-Fi et du Bluetooth, Shelf de fichiers avec envoi au téléphone, presse-papiers, miroir de webcam et agents IA (Claude Code, Codex).",
            "**DynamicWin** (open source) : une île inspirée de l'iPhone avec des widgets et un tiroir de fichiers.",
            "**Notchify** : une encoche façon Mac en haut de l'écran, présentée par Windows Central.",
            "**Isle** : une pilule pour les notifications, la musique et l'état du système, sur le Microsoft Store.",
            "**Tomte** : invisible jusqu'à ce qu'on pousse la souris en haut de l'écran, qu'on presse un raccourci ou qu'on y glisse un fichier.",
            "**WinIsland** : une capsule centrée sur la musique, avec pochette et contrôles.",
            "**Dynamic Edge** : une île pour Windows signalée par Clubic.",
          ],
        },
        {
          h2: "Laquelle choisir ?",
          p: [
            "Pour une île qui ne fait que la musique, WinIsland suffit. Pour une île complète, qui remplace plusieurs petits outils (paroles, lanceur, presse-papiers, minuteur, agenda) sans abonnement ni compte, [Quiera](https://quiera.eu) réunit tout gratuitement, avec un code public. Le plus simple reste d'en essayer deux : une île se désinstalle comme n'importe quelle appli.",
          ],
        },
      ],
    },
    en: {
      title: "The best Dynamic Island apps for Windows (2026 comparison)",
      description: "DynamicWin, Notchify, Isle, Tomte, WinIsland, Dynamic Edge, Quiera: the apps that add a Dynamic Island to Windows, what each does, and which to pick.",
      intro: "Since the Dynamic Island came to iPhone, a dozen apps have brought it to Windows. Here are the main ones, from their makers' pages and the press (read in November 2026).",
      blocks: [
        {
          h2: "What sets them apart",
          list: [
            "**What they show**: music only, or notifications, calendar, files and AI agents too.",
            "**How discreet they are**: always visible, or hidden until the pointer comes close, and gone in fullscreen.",
            "**Price and code**: free or paid, open source or closed.",
            "**Their weight** on CPU and memory.",
          ],
        },
        {
          h2: "The apps",
          list: [
            "**[Quiera](https://quiera.eu/en/)** (free, open source): music with word-by-word synced lyrics, a Spotlight-style launcher, notifications, calendar with a Join button, timer, sound, Wi-Fi and Bluetooth controls, a file Shelf with send-to-phone, clipboard, webcam mirror and AI agents (Claude Code, Codex).",
            "**DynamicWin** (open source): an iPhone-inspired island with widgets and a file tray.",
            "**Notchify**: a Mac-style notch at the top of the screen, covered by Windows Central.",
            "**Isle**: a pill for notifications, music and system status, on the Microsoft Store.",
            "**Tomte**: invisible until you push the pointer to the top edge, press a hotkey or drag a file there.",
            "**WinIsland**: a music-focused capsule with artwork and controls.",
            "**Dynamic Edge**: a Windows island covered by Clubic.",
          ],
        },
        {
          h2: "Which one to pick?",
          p: [
            "For an island that only does music, WinIsland is enough. For a full island that replaces several small tools (lyrics, launcher, clipboard, timer, calendar) with no subscription or account, [Quiera](https://quiera.eu/en/) has it all for free, with public code. The easiest is to try two: an island uninstalls like any app.",
          ],
        },
      ],
    },
  },
  {
    slug: "free-dynamic-island-windows-11",
    category: "island",
    updated: "2026-11-08",
    related: ["best-dynamic-island-windows", "dynamic-island-windows", "notchnook-alternative-windows"],
    fr: {
      slug: "dynamic-island-gratuite-windows-11",
      title: "Une Dynamic Island gratuite pour Windows 11",
      description: "Les Dynamic Islands gratuites pour Windows 11 : ce qu'elles font, ce qui distingue Quiera (gratuite et open source), et comment choisir.",
      intro: "Beaucoup d'îles pour Windows sont payantes ou limitées. Voici ce qu'on peut avoir gratuitement.",
      blocks: [
        {
          h2: "Ce qu'il faut vérifier",
          list: [
            "**Vraiment gratuite**, sans fonctions bloquées derrière un abonnement.",
            "**Open source** : le code est public, on peut vérifier ce qu'elle fait.",
            "**Légère** et **discrète en jeu**.",
            "**Sans compte ni télémétrie**.",
          ],
        },
        {
          h2: "Quiera",
          p: [
            Q + " est gratuite et libre (licence GPL-3.0) : musique et paroles synchronisées, lanceur, notifications, contrôles du son et du Wi-Fi, Shelf de fichiers, presse-papiers, agenda avec bouton Rejoindre, minuteur, miroir de webcam, et un onglet pour les agents IA (Claude Code, Codex). Pas de compte, pas de publicité, pas de statistiques.",
          ],
        },
        {
          h2: "Les autres",
          p: [
            "Il existe d'autres îles gratuites (DynamicWin, des mods Windhawk…), souvent plus simples, et des payantes sur le Microsoft Store. Le plus simple est d'en essayer une : une île se désinstalle comme n'importe quelle appli.",
          ],
        },
      ],
    },
    en: {
      title: "A free Dynamic Island for Windows 11",
      description: "Free Dynamic Islands for Windows 11: what they do, what sets Quiera apart (free and open source), and how to choose.",
      intro: "Many islands for Windows are paid or limited. Here's what you can get for free.",
      blocks: [
        {
          h2: "What to check",
          list: ["**Truly free**, no features locked behind a subscription.", "**Open source**: the code is public, you can check what it does.", "**Light** and **out of the way in games**.", "**No account, no telemetry**."],
        },
        {
          h2: "Quiera",
          p: [
            QEN + " is free and open source (GPL-3.0): music and synced lyrics, launcher, notifications, sound and Wi-Fi controls, a file Shelf, clipboard, calendar with a Join button, timer, webcam mirror, and a tab for AI agents (Claude Code, Codex). No account, no ads, no statistics.",
          ],
        },
        {
          h2: "The others",
          p: ["There are other free islands (DynamicWin, Windhawk mods…), often simpler, and paid ones on the Microsoft Store. The easiest is to try one: an island uninstalls like any app."],
        },
      ],
    },
  },
  {
    slug: "notchnook-alternative-windows",
    category: "island",
    updated: "2026-11-08",
    related: ["dynamic-island-windows", "keep-files-at-hand", "free-dynamic-island-windows-11"],
    fr: {
      slug: "notchnook-alcove-windows",
      title: "NotchNook, Alcove, Boring Notch : leur équivalent sous Windows",
      description: "NotchNook, Alcove et Boring Notch transforment l'encoche du Mac. Voici comment avoir les mêmes fonctions sur un PC Windows.",
      intro: "Sur Mac, NotchNook, Alcove ou Boring Notch font de l'encoche un petit tiroir : musique, fichiers, calendrier. Aucune n'existe pour Windows.",
      blocks: [
        {
          h2: "Ce qu'elles font sur Mac",
          list: ["Contrôle de la musique avec pochette.", "Un « tiroir » où déposer des fichiers.", "Le calendrier, la batterie, des widgets."],
        },
        {
          h2: "La même chose sous Windows",
          p: [
            Q + " met une île en haut de l'écran du PC, même sans encoche : survole-la pour l'ouvrir. Tu y retrouves la musique avec ses paroles, un **Shelf** où glisser des fichiers (et les envoyer au téléphone par QR code), l'**agenda** avec un bouton Rejoindre, les **batteries** Bluetooth, et en plus un lanceur, les notifications et les contrôles du son.",
          ],
        },
      ],
    },
    en: {
      title: "NotchNook, Alcove, Boring Notch: their Windows equivalent",
      description: "NotchNook, Alcove and Boring Notch turn the Mac's notch into a hub. Here's how to get the same features on a Windows PC.",
      intro: "On Mac, NotchNook, Alcove or Boring Notch make the notch a small drawer: music, files, calendar. None of them exists for Windows.",
      blocks: [
        {
          h2: "What they do on Mac",
          list: ["Music control with artwork.", "A “tray” to drop files into.", "Calendar, battery, widgets."],
        },
        {
          h2: "The same on Windows",
          p: [
            QEN + " puts an island at the top of the PC's screen, notch or not: hover it to open it. You get music with its lyrics, a **Shelf** to drop files into (and send them to your phone by QR code), the **calendar** with a Join button, Bluetooth **batteries**, and on top of that a launcher, notifications and sound controls.",
          ],
        },
      ],
    },
  },
  {
    slug: "hide-island-in-games",
    category: "island",
    updated: "2026-11-08",
    related: ["dynamic-island-windows", "customize-island-tabs", "caps-lock-indicator-windows"],
    fr: {
      slug: "cacher-dynamic-island-jeux",
      title: "Cacher la Dynamic Island pendant un jeu (et la rappeler)",
      description: "Comment Quiera se cache en plein écran, et comment l'afficher ou la masquer à tout moment avec un raccourci, même en jeu.",
      intro: "Une île ne doit jamais gêner un jeu ou un film. Voici comment Quiera s'efface, et comment la rappeler.",
      blocks: [
        {
          h2: "En plein écran, elle se cache seule",
          p: ["Quand un jeu ou une vidéo passe en plein écran sur l'écran de l'île, elle disparaît et ne consomme presque plus rien. Réglages › Général permet de la garder visible si tu préfères."],
        },
        {
          h2: "Un raccourci pour la montrer ou la cacher",
          p: [
            "**Ctrl+Alt+I** affiche l'île par-dessus le jeu, puis la recache. Dans Réglages › Général, tu peux choisir ton propre raccourci : une combinaison, une seule touche (F9…), ou une touche pressée deux fois (Ctrl Ctrl).",
          ],
        },
        {
          h2: "Elle laisse passer les clics",
          p: ["Fermée, l'île laisse passer les clics vers ce qu'il y a dessous (les onglets du navigateur restent cliquables), et s'ouvre quand la souris s'y pose."],
        },
      ],
    },
    en: {
      title: "Hide the Dynamic Island during a game (and bring it back)",
      description: "How Quiera hides in fullscreen, and how to show or hide it at any time with a shortcut, even in a game.",
      intro: "An island should never get in the way of a game or a film. Here's how Quiera steps aside, and how to call it back.",
      blocks: [
        {
          h2: "In fullscreen, it hides by itself",
          p: ["When a game or a video goes fullscreen on the island's screen, it disappears and uses almost nothing. Settings › General lets you keep it visible if you prefer."],
        },
        {
          h2: "A shortcut to show or hide it",
          p: ["**Ctrl+Alt+I** shows the island over the game, then hides it again. In Settings › General you can pick your own: a combination, a single key (F9…), or a key pressed twice (Ctrl Ctrl)."],
        },
        {
          h2: "It lets clicks through",
          p: ["Closed, the island lets clicks through to what lies below (your browser's tabs stay clickable), and opens when the pointer rests on it."],
        },
      ],
    },
  },
  {
    slug: "customize-island-tabs",
    category: "island",
    updated: "2026-11-08",
    related: ["dynamic-island-windows", "hide-island-in-games", "windows-notifications-island"],
    fr: {
      slug: "personnaliser-onglets-dynamic-island",
      title: "Personnaliser les onglets de la Dynamic Island",
      description: "Choisir l'ordre des onglets de Quiera, masquer ceux dont tu ne te sers pas, et ouvrir les réglages depuis l'île.",
      intro: "L'île ouverte a une rangée d'onglets : musique, minuteur, agenda, agents, contrôles, miroir, notifications, Shelf, presse-papiers. Tu les arranges à ton goût.",
      blocks: [
        {
          h2: "Changer l'ordre, masquer un onglet",
          steps: [
            "Ouvre les réglages : la roue dentée au bout des onglets de l'île, ou tape « réglages » dans le lanceur.",
            "Section Onglets : glisse-les pour les réordonner, décoche ceux que tu veux masquer.",
          ],
          p: ["Un onglet masqué revient seulement quand l'île s'ouvre dessus (le minuteur qui sonne, une notification)."],
        },
        {
          h2: "Ceux qui n'apparaissent que s'ils servent",
          p: ["Agenda, Agents, Notifications, Shelf et Presse-papiers n'apparaissent que lorsqu'ils contiennent quelque chose : l'île reste simple."],
        },
      ],
    },
    en: {
      title: "Customize the Dynamic Island's tabs",
      description: "Choose the order of Quiera's tabs, hide the ones you don't use, and open the settings from the island.",
      intro: "The open island has a row of tabs: music, timer, calendar, agents, controls, mirror, notifications, Shelf, clipboard. Arrange them your way.",
      blocks: [
        {
          h2: "Reorder, hide a tab",
          steps: ["Open the settings: the gear at the end of the island's tabs, or type “settings” in the launcher.", "Tabs section: drag them to reorder, untick the ones to hide."],
          p: ["A hidden tab only comes back when the island opens on it (the timer ringing, a notification)."],
        },
        {
          h2: "The ones that show only when useful",
          p: ["Calendar, Agents, Notifications, Shelf and Clipboard only show when they hold something: the island stays simple."],
        },
      ],
    },
  },

  /* ------------------------------------------------------------ Music */
  {
    slug: "spotify-lyrics-pc",
    category: "music",
    updated: "2026-11-08",
    related: ["word-by-word-lyrics", "now-playing-top-of-screen", "control-music-without-opening-app"],
    fr: {
      slug: "paroles-spotify-pc",
      title: "Afficher les paroles synchronisées de Spotify sur PC",
      description: "Comment voir les paroles en temps réel de Spotify (et d'autres applis) sur Windows : dans Spotify, et en permanence en haut de l'écran.",
      intro: "Spotify affiche les paroles dans sa fenêtre. Mais dès que tu travailles dans une autre appli, elles disparaissent.",
      blocks: [
        {
          h2: "Dans Spotify",
          p: ["Dans l'appli de bureau, le bouton micro (« Paroles ») en bas à droite affiche les paroles qui défilent, quand Spotify les a pour ce morceau."],
        },
        {
          h2: "En haut de l'écran, avec Quiera",
          p: [
            Q + " affiche le mot chanté directement dans la pilule, par-dessus tout, et les lignes complètes quand tu ouvres le lecteur. Ça marche avec Spotify, mais aussi Deezer, YouTube dans le navigateur ou Apple Music : toute appli qui annonce sa lecture à Windows.",
          ],
        },
        {
          h2: "D'où viennent les paroles",
          p: ["Quiera les cherche dans LRCLIB, une base ouverte de paroles synchronisées, à partir du titre, de l'artiste, de l'album et de la durée. Si elles arrivent en avance ou en retard, un décalage se règle dans Réglages › Musique."],
        },
      ],
    },
    en: {
      title: "Show Spotify's synced lyrics on PC",
      description: "How to see Spotify's real-time lyrics (and other apps') on Windows: in Spotify, and always at the top of the screen.",
      intro: "Spotify shows lyrics in its own window. But as soon as you work in another app, they're gone.",
      blocks: [
        {
          h2: "In Spotify",
          p: ["In the desktop app, the microphone button (“Lyrics”) at the bottom right shows scrolling lyrics, when Spotify has them for the track."],
        },
        {
          h2: "At the top of the screen, with Quiera",
          p: [QEN + " shows the word being sung right in the pill, over everything, and full lines when you open the player. It works with Spotify, but also Deezer, YouTube in the browser or Apple Music: any app that tells Windows what it plays."],
        },
        {
          h2: "Where the lyrics come from",
          p: ["Quiera looks them up in LRCLIB, an open database of synced lyrics, from the title, artist, album and duration. If they come early or late, an offset is set in Settings › Music."],
        },
      ],
    },
  },
  {
    slug: "word-by-word-lyrics",
    category: "music",
    updated: "2026-11-08",
    related: ["spotify-lyrics-pc", "now-playing-top-of-screen", "switch-between-audio-sources"],
    fr: {
      slug: "paroles-mot-a-mot-karaoke-pc",
      title: "Des paroles mot à mot, façon karaoké, sur Windows",
      description: "Voir chaque mot s'allumer au moment où il est chanté, sur PC : comment fonctionnent les paroles mot à mot et comment les activer dans Quiera.",
      intro: "Les paroles « synchronisées » le sont souvent ligne par ligne. Le mot à mot suit la voix, mot après mot.",
      blocks: [
        {
          h2: "Ligne par ligne ou mot à mot",
          p: ["Les fichiers de paroles les plus courants (LRC) donnent l'heure de chaque ligne. Certaines sources donnent aussi l'heure de chaque mot, ce qui permet l'effet karaoké."],
        },
        {
          h2: "Dans Quiera",
          p: [
            "La pilule de " + Q + " affiche le mot en cours ; le lecteur montre la ligne, mot à mot quand c'est possible. Une source mot à mot (NetEase) peut s'activer dans Réglages › Musique : elle est coupée par défaut car son service n'est pas officiel.",
          ],
        },
      ],
    },
    en: {
      title: "Word-by-word, karaoke-style lyrics on Windows",
      description: "See each word light up as it's sung, on PC: how word-by-word lyrics work and how to turn them on in Quiera.",
      intro: "“Synced” lyrics are often synced line by line. Word by word follows the voice, one word after another.",
      blocks: [
        {
          h2: "Line by line or word by word",
          p: ["The most common lyrics files (LRC) give the time of each line. Some sources also give the time of each word, which makes the karaoke effect possible."],
        },
        {
          h2: "In Quiera",
          p: [QEN + "'s pill shows the current word; the player shows the line, word by word when possible. A word-by-word source (NetEase) can be turned on in Settings › Music: it's off by default as its service isn't official."],
        },
      ],
    },
  },
  {
    slug: "now-playing-top-of-screen",
    category: "music",
    updated: "2026-11-08",
    related: ["control-music-without-opening-app", "spotify-lyrics-pc", "switch-between-audio-sources"],
    fr: {
      slug: "musique-en-cours-haut-ecran",
      title: "Voir la musique en cours en haut de l'écran sur Windows",
      description: "Afficher en permanence le titre, l'artiste et la pochette du morceau en cours sur PC, quelle que soit l'appli qui joue.",
      intro: "Quel est ce morceau ? Sur Windows, il faut d'habitude ouvrir l'appli ou appuyer sur une touche de volume pour le savoir.",
      blocks: [
        {
          h2: "Ce que propose Windows",
          p: ["Les touches multimédia et les boutons de volume affichent un petit panneau avec le morceau en cours, quelques secondes seulement."],
        },
        {
          h2: "En permanence, avec Quiera",
          p: [
            "Quand la musique joue, la pilule de " + Q + " montre le mot chanté et une onde ; à chaque changement de morceau, un aperçu montre la pochette, le titre et l'artiste. Survole l'île : le lecteur s'ouvre avec la progression, les boutons, l'aléatoire et la répétition.",
          ],
        },
      ],
    },
    en: {
      title: "See what's playing at the top of the screen on Windows",
      description: "Always show the title, artist and artwork of the current track on PC, whatever app is playing.",
      intro: "What's this song? On Windows, you usually have to open the app or press a volume key to find out.",
      blocks: [
        {
          h2: "What Windows offers",
          p: ["Media keys and volume buttons show a small panel with the current track, for a few seconds only."],
        },
        {
          h2: "All the time, with Quiera",
          p: [
            "While music plays, " + QEN + "'s pill shows the word being sung and a wave; at each new track, a peek shows the artwork, title and artist. Hover the island: the player opens with progress, buttons, shuffle and repeat.",
          ],
        },
      ],
    },
  },
  {
    slug: "control-music-without-opening-app",
    category: "music",
    updated: "2026-11-08",
    related: ["now-playing-top-of-screen", "switch-between-audio-sources", "change-audio-output-windows"],
    fr: {
      slug: "controler-spotify-sans-ouvrir",
      title: "Contrôler Spotify ou YouTube sans ouvrir l'appli",
      description: "Mettre en pause, passer au morceau suivant ou avancer dans un titre sur Windows sans changer de fenêtre.",
      intro: "Changer de morceau oblige souvent à chercher la fenêtre de Spotify ou l'onglet YouTube. Il y a plus simple.",
      blocks: [
        {
          h2: "Les touches multimédia",
          p: ["Si ton clavier en a, lecture/pause, suivant et précédent marchent avec la plupart des applis."],
        },
        {
          h2: "Depuis l'île",
          p: [
            "Survole " + Q + " : le lecteur s'ouvre avec lecture/pause, précédent, suivant, aléatoire, répétition, et une barre de progression qu'on peut faire glisser. Un clic sur une ligne des paroles saute à ce passage.",
          ],
        },
      ],
    },
    en: {
      title: "Control Spotify or YouTube without opening the app",
      description: "Pause, skip to the next track or seek within a song on Windows without switching windows.",
      intro: "Changing tracks often means hunting for Spotify's window or the YouTube tab. There's a simpler way.",
      blocks: [
        {
          h2: "Media keys",
          p: ["If your keyboard has them, play/pause, next and previous work with most apps."],
        },
        {
          h2: "From the island",
          p: [
            "Hover " + QEN + ": the player opens with play/pause, previous, next, shuffle, repeat, and a progress bar you can drag. Clicking a line of the lyrics jumps to that part.",
          ],
        },
      ],
    },
  },
  {
    slug: "switch-between-audio-sources",
    category: "music",
    updated: "2026-11-08",
    related: ["control-music-without-opening-app", "now-playing-top-of-screen", "volume-per-app-windows"],
    fr: {
      slug: "changer-source-audio-windows",
      title: "Passer d'une source audio à l'autre sur Windows (Spotify, YouTube…)",
      description: "Spotify et une vidéo YouTube jouent en même temps ? Comment choisir laquelle contrôler sur Windows.",
      intro: "Quand plusieurs applis jouent, les touches multimédia de Windows ne contrôlent qu'une source, et pas toujours celle que tu veux.",
      blocks: [
        {
          h2: "Avec Quiera",
          p: [
            "Quand plusieurs sources jouent, des points apparaissent sous le lecteur de " + Q + ". Clique sur un point pour passer à cette source : le lecteur et les boutons la contrôlent alors.",
          ],
        },
      ],
    },
    en: {
      title: "Switch between audio sources on Windows (Spotify, YouTube…)",
      description: "Spotify and a YouTube video playing at once? How to pick which one to control on Windows.",
      intro: "When several apps play, Windows' media keys control only one source, and not always the one you want.",
      blocks: [
        {
          h2: "With Quiera",
          p: ["When several sources play, dots appear under " + QEN + "'s player. Click a dot to switch to that source: the player and its buttons then control it."],
        },
      ],
    },
  },

  /* ------------------------------------------------------------ Launcher & productivity */
  {
    slug: "spotlight-for-windows",
    category: "productivity",
    updated: "2026-11-08",
    related: ["powertoys-run-alternative", "find-files-fast-windows", "quick-calculator-windows"],
    fr: {
      slug: "spotlight-windows",
      title: "Spotlight pour Windows : un lanceur au clavier",
      description: "Ouvrir une appli, un fichier ou faire un calcul en tapant quelques lettres sur Windows, comme Spotlight sur Mac.",
      intro: "Sur Mac, Cmd+Espace ouvre Spotlight. Sur Windows, la recherche du menu Démarrer est plus lente et mêle souvent des résultats web.",
      blocks: [
        {
          h2: "Le lanceur de Quiera",
          p: ["Appuie sur **Alt+Espace** : une barre de recherche s'ouvre dans l'île. Tape quelques lettres, puis Entrée."],
          list: [
            "**Applis** : « spo » pour Spotify.",
            "**Fichiers** de tous tes disques, indexés au démarrage.",
            "**Filtres** : « images », « vidéos », « musique » ou « documents ».",
            "**Calculs** : « 12*4+2 » ; Entrée copie le résultat.",
            "**Minuteurs** : « 5 min », « pomodoro ».",
            "**Agents IA** : « claude corrige les tests » ouvre un terminal avec l'agent.",
            "**Web** : la dernière ligne cherche sur Google.",
          ],
        },
        {
          h2: "Changer le raccourci",
          p: ["Réglages › Lanceur : choisis un autre raccourci si Alt+Espace est déjà pris."],
        },
      ],
    },
    en: {
      title: "Spotlight for Windows: a keyboard launcher",
      description: "Open an app, a file or do a calculation by typing a few letters on Windows, like Spotlight on Mac.",
      intro: "On Mac, Cmd+Space opens Spotlight. On Windows, the Start menu search is slower and often mixes in web results.",
      blocks: [
        {
          h2: "Quiera's launcher",
          p: ["Press **Alt+Space**: a search bar opens in the island. Type a few letters, then Enter."],
          list: [
            "**Apps**: “spo” for Spotify.",
            "**Files** from all your drives, indexed at start.",
            "**Filters**: “images”, “videos”, “music” or “documents”.",
            "**Calculations**: “12*4+2”; Enter copies the result.",
            "**Timers**: “5 min”, “pomodoro”.",
            "**AI agents**: “claude fix the tests” opens a terminal with the agent.",
            "**Web**: the last line searches Google.",
          ],
        },
        {
          h2: "Change the shortcut",
          p: ["Settings › Launcher: pick another shortcut if Alt+Space is already taken."],
        },
      ],
    },
  },
  {
    slug: "powertoys-run-alternative",
    category: "productivity",
    updated: "2026-11-08",
    related: ["spotlight-for-windows", "find-files-fast-windows", "quick-calculator-windows"],
    fr: {
      slug: "alternative-powertoys-run",
      title: "Une alternative à PowerToys Run",
      description: "PowerToys Run (et sa Command Palette) ou le lanceur de Quiera : les différences, et quand préférer l'un ou l'autre.",
      intro: "PowerToys Run, l'outil de Microsoft, ouvre un lanceur avec Alt+Espace ; Microsoft le fait évoluer vers la Command Palette. Quiera propose aussi un lanceur, intégré à son île.",
      blocks: [
        {
          h2: "PowerToys Run et la Command Palette",
          p: ["Très complets, avec de nombreuses extensions (unités, fenêtres ouvertes, commandes système…). Ils font partie de PowerToys, une suite de nombreux outils."],
        },
        {
          h2: "Le lanceur de Quiera",
          p: [
            "Plus simple, il vit dans l'île : applis, fichiers de tous les disques, filtres par type, calculs, minuteurs, lancement d'agents IA et recherche web. Pas besoin d'installer une suite entière si tu veux surtout une Dynamic Island et un lanceur. " + Q + " est gratuit.",
          ],
        },
        {
          h2: "Les deux ensemble ?",
          p: ["Ils utilisent tous deux Alt+Espace par défaut : change le raccourci de l'un des deux (Réglages › Lanceur dans Quiera)."],
        },
      ],
    },
    en: {
      title: "A PowerToys Run alternative",
      description: "PowerToys Run (and its Command Palette) or Quiera's launcher: the differences, and when to prefer one or the other.",
      intro: "PowerToys Run, Microsoft's tool, opens a launcher with Alt+Space; Microsoft is moving it toward the Command Palette. Quiera has a launcher too, built into its island.",
      blocks: [
        {
          h2: "PowerToys Run and the Command Palette",
          p: ["Very complete, with many extensions (units, open windows, system commands…). They're part of PowerToys, a suite of many tools."],
        },
        {
          h2: "Quiera's launcher",
          p: ["Simpler, it lives in the island: apps, files from all drives, type filters, calculations, timers, starting AI agents and web search. No need for a whole suite if you mostly want a Dynamic Island and a launcher. " + QEN + " is free."],
        },
        {
          h2: "Both together?",
          p: ["Both use Alt+Space by default: change one of their shortcuts (Settings › Launcher in Quiera)."],
        },
      ],
    },
  },
  {
    slug: "find-files-fast-windows",
    category: "productivity",
    updated: "2026-11-08",
    related: ["spotlight-for-windows", "powertoys-run-alternative", "keep-files-at-hand"],
    fr: {
      slug: "trouver-fichier-rapidement-windows",
      title: "Trouver un fichier rapidement sur Windows",
      description: "Retrouver un document, une image ou une vidéo en quelques lettres sur PC, sans attendre la recherche de l'Explorateur.",
      intro: "La recherche de l'Explorateur Windows est lente hors des dossiers indexés. Quelques astuces changent tout.",
      blocks: [
        {
          h2: "Dans Windows",
          list: ["La recherche du menu Démarrer trouve les fichiers des dossiers indexés (Documents, Bureau…).", "Dans l'Explorateur, la barre de recherche cherche dans le dossier ouvert, plus lentement ailleurs."],
        },
        {
          h2: "Avec le lanceur de Quiera",
          p: [
            "Alt+Espace puis quelques lettres du nom : " + Q + " cherche dans un index des noms de fichiers de **tous tes disques**, construit au démarrage. Ajoute « images », « vidéos », « musique » ou « documents » pour filtrer. Entrée ouvre le fichier, Ctrl+Entrée ouvre son dossier.",
          ],
        },
      ],
    },
    en: {
      title: "Find a file fast on Windows",
      description: "Find a document, a picture or a video in a few letters on PC, without waiting for File Explorer's search.",
      intro: "File Explorer's search is slow outside indexed folders. A few tricks change everything.",
      blocks: [
        {
          h2: "In Windows",
          list: ["Start menu search finds files in indexed folders (Documents, Desktop…).", "In File Explorer, the search box searches the open folder, more slowly elsewhere."],
        },
        {
          h2: "With Quiera's launcher",
          p: ["Alt+Space then a few letters of the name: " + QEN + " searches an index of file names from **all your drives**, built at start. Add “images”, “videos”, “music” or “documents” to filter. Enter opens the file, Ctrl+Enter its folder."],
        },
      ],
    },
  },
  {
    slug: "quick-calculator-windows",
    category: "productivity",
    updated: "2026-11-08",
    related: ["spotlight-for-windows", "timer-on-pc", "clipboard-history-windows"],
    fr: {
      slug: "calcul-rapide-windows",
      title: "Faire un calcul rapide sur Windows sans ouvrir la Calculatrice",
      description: "Calculer en tapant directement l'opération sur PC, et copier le résultat en une touche.",
      intro: "Ouvrir la Calculatrice pour une seule opération, c'est long. On peut taper le calcul directement.",
      blocks: [
        {
          h2: "Avec Quiera",
          steps: ["Alt+Espace.", "Tape l'opération : « (18+6)/4 », « 12*4+2 », « 2^10 ».", "Le résultat s'affiche aussitôt ; Entrée le copie dans le presse-papiers."],
          p: [Q + " affiche le résultat dans le format de ta langue (virgule décimale en français)."],
        },
      ],
    },
    en: {
      title: "Do a quick calculation on Windows without opening Calculator",
      description: "Calculate by typing the operation directly on PC, and copy the result with one key.",
      intro: "Opening Calculator for a single operation takes too long. You can type the calculation directly.",
      blocks: [
        {
          h2: "With Quiera",
          steps: ["Alt+Space.", "Type the operation: “(18+6)/4”, “12*4+2”, “2^10”.", "The result shows at once; Enter copies it to the clipboard."],
          p: [QEN + " shows the result in your language's format."],
        },
      ],
    },
  },
  {
    slug: "timer-on-pc",
    category: "productivity",
    updated: "2026-11-08",
    related: ["pomodoro-windows", "spotlight-for-windows", "quick-calculator-windows"],
    fr: {
      slug: "minuteur-pc-windows",
      title: "Mettre un minuteur sur PC Windows",
      description: "Lancer un minuteur en deux secondes sur Windows et le garder sous les yeux : l'appli Horloge, ou le minuteur de la Dynamic Island.",
      intro: "Cuisson, réunion, pause : un minuteur doit se lancer vite et rester visible.",
      blocks: [
        {
          h2: "L'appli Horloge de Windows",
          p: ["Elle a un onglet Minuteur, mais sa fenêtre disparaît derrière les autres."],
        },
        {
          h2: "Le minuteur de Quiera",
          list: [
            "Alt+Espace puis « 5 min », « 1h30 », « 90s » : Entrée le lance.",
            "Ou l'onglet Minuteur de l'île, avec des roues pour choisir la durée.",
            "Le compte à rebours reste dans la pilule, par-dessus tout ; l'île sonne à la fin.",
          ],
        },
      ],
    },
    en: {
      title: "Set a timer on a Windows PC",
      description: "Start a timer in two seconds on Windows and keep it in sight: the Clock app, or the Dynamic Island's timer.",
      intro: "Cooking, a meeting, a break: a timer should start fast and stay visible.",
      blocks: [
        { h2: "Windows' Clock app", p: ["It has a Timer tab, but its window disappears behind the others."] },
        {
          h2: "Quiera's timer",
          list: ["Alt+Space then “5 min”, “1h30”, “90s”: Enter starts it.", "Or the island's Timer tab, with wheels to pick the time.", "The countdown stays in the pill, over everything; the island rings at the end."],
        },
      ],
    },
  },
  {
    slug: "pomodoro-windows",
    category: "productivity",
    updated: "2026-11-08",
    related: ["timer-on-pc", "spotlight-for-windows", "windows-notifications-island"],
    fr: {
      slug: "pomodoro-windows",
      title: "La méthode Pomodoro sur Windows",
      description: "Travailler par sessions de 25 minutes sur PC avec un minuteur toujours visible.",
      intro: "La méthode Pomodoro : 25 minutes de travail concentré, puis une courte pause. Le plus dur est de garder le minuteur en vue.",
      blocks: [
        {
          h2: "Avec Quiera",
          steps: ["Alt+Espace, tape « pomodoro », Entrée : 25 minutes démarrent.", "Le temps restant reste dans la pilule en haut de l'écran.", "À la fin, l'île sonne ; relance une session ou prends ta pause."],
        },
        {
          h2: "Avec Windows",
          p: ["L'appli Horloge propose aussi des « sessions de concentration », liées à To Do et Spotify."],
        },
      ],
    },
    en: {
      title: "The Pomodoro technique on Windows",
      description: "Work in 25-minute sessions on PC with a timer always in sight.",
      intro: "The Pomodoro technique: 25 minutes of focused work, then a short break. The hard part is keeping the timer in view.",
      blocks: [
        { h2: "With Quiera", steps: ["Alt+Space, type “pomodoro”, Enter: 25 minutes start.", "The time left stays in the pill at the top of the screen.", "At the end, the island rings; start another session or take your break."] },
        { h2: "With Windows", p: ["The Clock app also has “focus sessions”, linked to To Do and Spotify."] },
      ],
    },
  },
  {
    slug: "clipboard-history-windows",
    category: "productivity",
    updated: "2026-11-08",
    related: ["keep-files-at-hand", "quick-calculator-windows", "spotlight-for-windows"],
    fr: {
      slug: "historique-presse-papiers-windows",
      title: "L'historique du presse-papiers sur Windows (Win+V et mieux)",
      description: "Retrouver ce que tu as copié plus tôt sur Windows : l'historique Win+V, et le presse-papiers de la Dynamic Island.",
      intro: "Tu as copié un lien, puis un texte… et le lien est perdu. Windows garde un historique, encore faut-il l'activer.",
      blocks: [
        {
          h2: "Win+V",
          p: ["Appuie sur **Win+V** : la première fois, Windows propose d'activer l'historique. Ensuite, Win+V liste tes dernières copies ; un clic colle l'élément choisi."],
        },
        {
          h2: "Dans l'île",
          p: [
            "L'onglet Presse-papiers de " + Q + " montre tes derniers textes, liens et images copiés ; un clic les recopie, l'épingle en garde un. L'historique reste en mémoire seulement, et les contenus marqués privés (mots de passe des gestionnaires) sont ignorés.",
          ],
        },
      ],
    },
    en: {
      title: "Clipboard history on Windows (Win+V and better)",
      description: "Get back what you copied earlier on Windows: Win+V history, and the Dynamic Island's clipboard.",
      intro: "You copied a link, then some text… and the link is gone. Windows keeps a history, if you turn it on.",
      blocks: [
        { h2: "Win+V", p: ["Press **Win+V**: the first time, Windows offers to turn history on. Then Win+V lists your latest copies; a click pastes the chosen one."] },
        {
          h2: "In the island",
          p: [QEN + "'s Clipboard tab shows your latest copied texts, links and images; a click copies them again, the pin keeps one. History stays in memory only, and content marked private (password managers) is skipped."],
        },
      ],
    },
  },

  /* ------------------------------------------------------------ Files & phone */
  {
    slug: "send-file-pc-to-iphone",
    category: "files",
    updated: "2026-11-08",
    related: ["send-file-pc-to-android", "keep-files-at-hand", "iphone-notifications"],
    fr: {
      slug: "envoyer-fichier-pc-iphone",
      title: "Envoyer un fichier du PC vers l'iPhone sans câble",
      description: "Les moyens de transférer une photo, un PDF ou une vidéo d'un PC Windows vers un iPhone : iCloud, applis, et un simple QR code sans appli.",
      intro: "Entre Windows et iPhone, pas d'AirDrop. Il existe plusieurs façons de faire passer un fichier.",
      blocks: [
        {
          h2: "Les solutions courantes",
          list: [
            "**iCloud Drive** sur le PC : le fichier arrive sur l'iPhone, en passant par Internet.",
            "**LocalSend** : appli libre à installer sur les deux appareils, sur le même Wi-Fi.",
            "**E-mail ou messagerie** : simple, mais limité en taille.",
          ],
        },
        {
          h2: "Sans appli, avec un QR code",
          steps: [
            "Glisse le fichier sur l'île de " + Q + " : il rejoint le Shelf.",
            "Clique sur « Envoyer au téléphone » : un QR code s'affiche.",
            "Scanne-le avec l'appareil photo de l'iPhone, sur le même Wi-Fi : Safari télécharge le fichier ; une image peut s'enregistrer dans Photos.",
          ],
          p: ["Rien ne passe par Internet, et le lien ne marche que 10 minutes."],
        },
      ],
    },
    en: {
      title: "Send a file from PC to iPhone without a cable",
      description: "Ways to move a photo, a PDF or a video from a Windows PC to an iPhone: iCloud, apps, and a simple QR code with no app.",
      intro: "Between Windows and iPhone, there's no AirDrop. There are several ways to get a file across.",
      blocks: [
        {
          h2: "The usual options",
          list: ["**iCloud Drive** on the PC: the file reaches the iPhone, through the Internet.", "**LocalSend**: a free app to install on both devices, on the same Wi-Fi.", "**Email or a messenger**: simple, but size-limited."],
        },
        {
          h2: "No app, with a QR code",
          steps: ["Drag the file onto " + QEN + "'s island: it joins the Shelf.", "Click “Send to phone”: a QR code shows.", "Scan it with the iPhone's camera, on the same Wi-Fi: Safari downloads the file; a picture can be saved to Photos."],
          p: ["Nothing goes through the Internet, and the link only works for 10 minutes."],
        },
      ],
    },
  },
  {
    slug: "send-file-pc-to-android",
    category: "files",
    updated: "2026-11-08",
    related: ["send-file-pc-to-iphone", "keep-files-at-hand", "clipboard-history-windows"],
    fr: {
      slug: "envoyer-fichier-pc-android",
      title: "Envoyer un fichier du PC vers un téléphone Android sans câble",
      description: "Transférer un fichier de Windows vers Android : Quick Share, Lien avec Windows, ou un QR code sans appli.",
      intro: "Entre un PC et un téléphone Android, plusieurs méthodes existent, plus ou moins simples à mettre en place.",
      blocks: [
        {
          h2: "Avec les outils de Google et Microsoft",
          list: ["**Quick Share** (Google) a une appli pour Windows.", "**Lien avec Windows** (Phone Link) relie un Android au PC et permet d'échanger des fichiers."],
        },
        {
          h2: "Sans rien installer",
          p: [
            "Glisse le fichier sur l'île de " + Q + ", puis « Envoyer au téléphone » : scanne le QR code avec le téléphone, sur le même Wi-Fi, et le fichier se télécharge dans le navigateur. Le lien expire au bout de 10 minutes ; rien ne passe par Internet.",
          ],
        },
      ],
    },
    en: {
      title: "Send a file from PC to an Android phone without a cable",
      description: "Move a file from Windows to Android: Quick Share, Phone Link, or a QR code with no app.",
      intro: "Between a PC and an Android phone, several methods exist, more or less easy to set up.",
      blocks: [
        { h2: "With Google's and Microsoft's tools", list: ["**Quick Share** (Google) has a Windows app.", "**Phone Link** links an Android phone to the PC and lets you swap files."] },
        {
          h2: "Without installing anything",
          p: ["Drag the file onto " + QEN + "'s island, then “Send to phone”: scan the QR code with the phone, on the same Wi-Fi, and the file downloads in the browser. The link expires after 10 minutes; nothing goes through the Internet."],
        },
      ],
    },
  },
  {
    slug: "keep-files-at-hand",
    category: "files",
    updated: "2026-11-08",
    related: ["send-file-pc-to-iphone", "notchnook-alternative-windows", "clipboard-history-windows"],
    fr: {
      slug: "dropover-yoink-windows",
      title: "Garder des fichiers sous la main pendant un glisser-déposer (Dropover, Yoink sur Windows)",
      description: "Un « tiroir » pour poser des fichiers le temps de changer de fenêtre, comme Dropover ou Yoink sur Mac, sous Windows.",
      intro: "Glisser un fichier d'une fenêtre à une autre qui est cachée, c'est pénible. Sur Mac, Dropover et Yoink offrent une étagère temporaire.",
      blocks: [
        {
          h2: "Le Shelf de Quiera",
          steps: [
            "Glisse un ou plusieurs fichiers vers le haut de l'écran : l'île s'ouvre sur le Shelf et les garde.",
            "Change de fenêtre tranquillement.",
            "Fais glisser le fichier depuis le Shelf jusqu'à sa destination.",
          ],
          p: [Q + " ne copie pas tes fichiers : le Shelf garde leurs chemins. Réglages › Presse-papiers et Shelf permet de le conserver entre deux sessions."],
        },
      ],
    },
    en: {
      title: "Keep files at hand while dragging (Dropover, Yoink on Windows)",
      description: "A “tray” to set files down while you switch windows, like Dropover or Yoink on Mac, on Windows.",
      intro: "Dragging a file to a window that's hidden is a pain. On Mac, Dropover and Yoink give you a temporary shelf.",
      blocks: [
        {
          h2: "Quiera's Shelf",
          steps: ["Drag one or more files to the top of the screen: the island opens on the Shelf and keeps them.", "Switch windows calmly.", "Drag the file from the Shelf to where it goes."],
          p: [QEN + " doesn't copy your files: the Shelf keeps their paths. Settings › Clipboard and Shelf can keep it between sessions."],
        },
      ],
    },
  },

  /* ------------------------------------------------------------ Calendar & calls */
  {
    slug: "meetings-on-windows-desktop",
    category: "calendar",
    updated: "2026-11-08",
    related: ["join-meeting-one-click", "google-calendar-ical-link", "outlook-calendar-ics-link"],
    fr: {
      slug: "reunions-agenda-bureau-windows",
      title: "Voir ses réunions Google Agenda ou Outlook sur le bureau Windows",
      description: "Afficher sa prochaine réunion en permanence sur PC, être prévenu quelques minutes avant, sans garder l'agenda ouvert.",
      intro: "Les rappels d'agenda arrivent dans un onglet du navigateur… quand il est ouvert. Mieux vaut voir la prochaine réunion d'un coup d'œil.",
      blocks: [
        {
          h2: "Avec Quiera",
          steps: [
            "Récupère le lien iCal secret de ton agenda (Google, Outlook ou iCloud).",
            "Colle-le dans Réglages › Agenda de " + Q + ".",
            "Quelques minutes avant chaque réunion (5, 10 ou 15, à choisir), l'île l'annonce ; l'onglet Agenda liste les prochains événements.",
          ],
          p: ["Le lien reste sur ton PC et n'est jamais écrit dans les journaux ; l'agenda est relu tous les quarts d'heure."],
        },
      ],
    },
    en: {
      title: "See your Google Calendar or Outlook meetings on the Windows desktop",
      description: "Show your next meeting at all times on PC and get a heads-up a few minutes before, without keeping the calendar open.",
      intro: "Calendar reminders show up in a browser tab… when it's open. Better to see your next meeting at a glance.",
      blocks: [
        {
          h2: "With Quiera",
          steps: ["Get your calendar's secret iCal link (Google, Outlook or iCloud).", "Paste it in " + QEN + "'s Settings › Calendar.", "A few minutes before each meeting (5, 10 or 15, your pick), the island announces it; the Calendar tab lists upcoming events."],
          p: ["The link stays on your PC and is never written in the logs; the calendar is read again every 15 minutes."],
        },
      ],
    },
  },
  {
    slug: "join-meeting-one-click",
    category: "calendar",
    updated: "2026-11-08",
    related: ["meetings-on-windows-desktop", "test-webcam-before-call", "google-calendar-ical-link"],
    fr: {
      slug: "rejoindre-reunion-teams-meet-zoom",
      title: "Rejoindre une réunion Teams, Meet ou Zoom en un clic",
      description: "Ne plus chercher le lien de la visio dans l'invitation : un bouton Rejoindre au bon moment, sur PC.",
      intro: "La réunion commence, et il faut retrouver l'invitation pour cliquer sur le lien. Ça peut être immédiat.",
      blocks: [
        {
          h2: "Le bouton Rejoindre de Quiera",
          p: [
            "Quand une réunion approche, " + Q + " l'annonce avec un bouton **Rejoindre** : il ouvre directement Teams, Google Meet, Zoom ou Webex, d'après le lien trouvé dans l'événement. Le bouton est aussi dans l'onglet Agenda.",
          ],
        },
        {
          h2: "Avant d'y aller",
          p: ["L'onglet Miroir de l'île montre ta webcam, pour un coup d'œil avant d'entrer."],
        },
      ],
    },
    en: {
      title: "Join a Teams, Meet or Zoom meeting in one click",
      description: "Stop hunting for the call link in the invite: a Join button at the right time, on PC.",
      intro: "The meeting starts, and you have to find the invite to click the link. It can be instant.",
      blocks: [
        {
          h2: "Quiera's Join button",
          p: ["When a meeting is near, " + QEN + " announces it with a **Join** button: it opens Teams, Google Meet, Zoom or Webex directly, from the link found in the event. The button is also in the Calendar tab."],
        },
        { h2: "Before you go", p: ["The island's Mirror tab shows your webcam, for a look before you join."] },
      ],
    },
  },
  {
    slug: "google-calendar-ical-link",
    category: "calendar",
    updated: "2026-11-08",
    related: ["meetings-on-windows-desktop", "outlook-calendar-ics-link", "join-meeting-one-click"],
    fr: {
      slug: "lien-ical-google-agenda",
      title: "Trouver le lien iCal secret de Google Agenda",
      description: "Où trouver « l'adresse secrète au format iCal » d'un agenda Google, pour l'afficher dans une autre appli, et comment la garder privée.",
      intro: "Pour afficher ton agenda Google dans une autre appli (comme Quiera), il faut son adresse secrète iCal.",
      blocks: [
        {
          h2: "Les étapes",
          steps: [
            "Ouvre Google Agenda sur le web (pas sur le téléphone).",
            "Roue dentée › Paramètres, puis, à gauche, clique sur ton agenda sous « Paramètres de mes agendas ».",
            "Section « Intégrer l'agenda » : copie « Adresse secrète au format iCal ».",
          ],
        },
        {
          h2: "La garder secrète",
          p: ["Cette adresse donne accès à tout l'agenda, sans mot de passe. Ne la partage pas ; si elle a fuité, Google permet de la réinitialiser au même endroit. " + Q + " la garde sur ton PC et ne l'écrit jamais dans ses journaux."],
        },
      ],
    },
    en: {
      title: "Find Google Calendar's secret iCal link",
      description: "Where to find a Google calendar's “secret address in iCal format”, to show it in another app, and how to keep it private.",
      intro: "To show your Google calendar in another app (like Quiera), you need its secret iCal address.",
      blocks: [
        {
          h2: "The steps",
          steps: ["Open Google Calendar on the web (not on the phone).", "Gear › Settings, then on the left click your calendar under “Settings for my calendars”.", "“Integrate calendar” section: copy “Secret address in iCal format”."],
        },
        {
          h2: "Keep it secret",
          p: ["This address gives access to the whole calendar, without a password. Don't share it; if it leaked, Google lets you reset it in the same place. " + QEN + " keeps it on your PC and never writes it in its logs."],
        },
      ],
    },
  },
  {
    slug: "outlook-calendar-ics-link",
    category: "calendar",
    updated: "2026-11-08",
    related: ["google-calendar-ical-link", "meetings-on-windows-desktop", "join-meeting-one-click"],
    fr: {
      slug: "lien-ics-calendrier-outlook",
      title: "Obtenir le lien ICS d'un calendrier Outlook",
      description: "Publier un calendrier Outlook ou Microsoft 365 et copier son lien ICS pour l'afficher dans une autre appli.",
      intro: "Outlook ne donne un lien ICS qu'après avoir « publié » le calendrier. Voici comment.",
      blocks: [
        {
          h2: "Les étapes (Outlook sur le web)",
          steps: [
            "Paramètres › Calendrier › Calendriers partagés.",
            "Sous « Publier un calendrier », choisis le calendrier et « Peut afficher tous les détails », puis Publier.",
            "Copie le lien **ICS** (pas le HTML).",
          ],
          p: ["Dans certaines entreprises, la publication est désactivée par l'administrateur."],
        },
        {
          h2: "Dans Quiera",
          p: ["Colle ce lien dans Réglages › Agenda de " + Q + " : tes réunions Teams apparaissent avec un bouton Rejoindre."],
        },
      ],
    },
    en: {
      title: "Get an Outlook calendar's ICS link",
      description: "Publish an Outlook or Microsoft 365 calendar and copy its ICS link to show it in another app.",
      intro: "Outlook only gives an ICS link once the calendar is “published”. Here's how.",
      blocks: [
        {
          h2: "The steps (Outlook on the web)",
          steps: ["Settings › Calendar › Shared calendars.", "Under “Publish a calendar”, pick the calendar and “Can view all details”, then Publish.", "Copy the **ICS** link (not the HTML one)."],
          p: ["In some companies, publishing is turned off by the administrator."],
        },
        { h2: "In Quiera", p: ["Paste this link in " + QEN + "'s Settings › Calendar: your Teams meetings show up with a Join button."] },
      ],
    },
  },
  {
    slug: "test-webcam-before-call",
    category: "calendar",
    updated: "2026-11-08",
    related: ["join-meeting-one-click", "meetings-on-windows-desktop", "change-audio-output-windows"],
    fr: {
      slug: "tester-webcam-windows",
      title: "Tester sa webcam avant une visio sur Windows",
      description: "Vérifier son image avant une réunion Teams, Meet ou Zoom : l'appli Caméra, ou un miroir en un clic dans la Dynamic Island.",
      intro: "Cadrage, lumière, cheveux : mieux vaut se voir avant d'entrer dans la réunion.",
      blocks: [
        {
          h2: "Avec Windows",
          p: ["L'appli **Caméra** montre ton image ; Paramètres › Bluetooth et appareils › Caméras permet aussi de régler luminosité et contraste."],
        },
        {
          h2: "Avec Quiera",
          p: ["L'onglet **Miroir** de " + Q + " affiche ta webcam dans l'île, comme un miroir. L'image n'est ni enregistrée ni envoyée, et la caméra se coupe quand tu changes d'onglet."],
        },
        {
          h2: "Si la caméra ne s'affiche pas",
          p: ["Vérifie Paramètres › Confidentialité et sécurité › Caméra › « Autoriser les applications de bureau à accéder à la caméra »."],
        },
      ],
    },
    en: {
      title: "Test your webcam before a video call on Windows",
      description: "Check your picture before a Teams, Meet or Zoom meeting: the Camera app, or a one-click mirror in the Dynamic Island.",
      intro: "Framing, light, hair: better see yourself before joining.",
      blocks: [
        { h2: "With Windows", p: ["The **Camera** app shows your picture; Settings › Bluetooth & devices › Cameras also lets you adjust brightness and contrast."] },
        { h2: "With Quiera", p: [QEN + "'s **Mirror** tab shows your webcam in the island, like a mirror. The picture is neither recorded nor sent, and the camera turns off when you switch tabs."] },
        { h2: "If the camera doesn't show", p: ["Check Settings › Privacy & security › Camera › “Let desktop apps access your camera”."] },
      ],
    },
  },

  /* ------------------------------------------------------------ Sound & devices */
  {
    slug: "change-audio-output-windows",
    category: "devices",
    updated: "2026-11-08",
    related: ["volume-per-app-windows", "bluetooth-headphones-battery-windows", "control-music-without-opening-app"],
    fr: {
      slug: "changer-sortie-audio-windows",
      title: "Changer de sortie audio rapidement sur Windows (casque, enceintes)",
      description: "Passer des enceintes au casque en un clic sur Windows 11, sans fouiller dans les paramètres du son.",
      intro: "Le casque est branché mais le son sort encore des enceintes. Changer de sortie devrait prendre une seconde.",
      blocks: [
        {
          h2: "Avec Windows 11",
          p: ["Clique sur l'icône du son dans la barre des tâches, puis sur la flèche à côté du volume : la liste des sorties s'affiche. **Win+Ctrl+V** ouvre directement ce panneau."],
        },
        {
          h2: "Avec Quiera",
          p: ["L'onglet Contrôles de " + Q + " montre la sortie actuelle ; un clic dessus liste les autres et bascule en un geste, avec le volume général juste à côté."],
        },
      ],
    },
    en: {
      title: "Switch audio output fast on Windows (headphones, speakers)",
      description: "Go from speakers to headphones in one click on Windows 11, without digging through sound settings.",
      intro: "The headphones are plugged in but sound still comes from the speakers. Switching output should take a second.",
      blocks: [
        { h2: "With Windows 11", p: ["Click the sound icon in the taskbar, then the arrow next to the volume: the outputs list shows. **Win+Ctrl+V** opens that panel directly."] },
        { h2: "With Quiera", p: [QEN + "'s Controls tab shows the current output; a click lists the others and switches in one move, with the main volume right next to it."] },
      ],
    },
  },
  {
    slug: "volume-per-app-windows",
    category: "devices",
    updated: "2026-11-08",
    related: ["change-audio-output-windows", "switch-between-audio-sources", "control-music-without-opening-app"],
    fr: {
      slug: "volume-par-application-windows",
      title: "Régler le volume de chaque application sur Windows",
      description: "Baisser le son d'un jeu ou de Discord sans toucher à la musique : le mélangeur de volume de Windows, et des curseurs dans la Dynamic Island.",
      intro: "Le jeu trop fort, la musique trop basse : Windows sait régler chaque appli séparément.",
      blocks: [
        {
          h2: "Le mélangeur de volume de Windows",
          p: ["Paramètres › Système › Son › Mélangeur de volume : un curseur par application. Clic droit sur l'icône du son dans la barre des tâches y mène aussi."],
        },
        {
          h2: "Dans l'île",
          p: ["L'onglet Contrôles de " + Q + " liste les applis qui font du son, avec leur icône et un curseur chacune, et un bouton pour couper une appli sans toucher aux autres."],
        },
      ],
    },
    en: {
      title: "Set each app's volume on Windows",
      description: "Lower a game's or Discord's sound without touching the music: Windows' volume mixer, and sliders in the Dynamic Island.",
      intro: "The game too loud, the music too quiet: Windows can set each app separately.",
      blocks: [
        { h2: "Windows' volume mixer", p: ["Settings › System › Sound › Volume mixer: one slider per app. Right-clicking the sound icon in the taskbar gets you there too."] },
        { h2: "In the island", p: [QEN + "'s Controls tab lists the apps making sound, with their icon and a slider each, and a button to mute one app without touching the others."] },
      ],
    },
  },
  {
    slug: "bluetooth-headphones-battery-windows",
    category: "devices",
    updated: "2026-11-08",
    related: ["airpods-battery-windows", "change-audio-output-windows", "caps-lock-indicator-windows"],
    fr: {
      slug: "batterie-casque-bluetooth-windows",
      title: "Voir la batterie de ses écouteurs, clavier ou souris Bluetooth sur Windows",
      description: "Où Windows affiche le niveau de batterie des appareils Bluetooth, et comment être prévenu quand il devient faible.",
      intro: "Le casque coupe en pleine réunion, la souris lâche au mauvais moment. Windows connaît souvent leur batterie, encore faut-il la voir.",
      blocks: [
        {
          h2: "Dans Windows",
          p: ["Paramètres › Bluetooth et appareils : le pourcentage s'affiche à côté des appareils qui le transmettent."],
        },
        {
          h2: "Avec Quiera",
          p: [
            "Quand un appareil se connecte, " + Q + " affiche un aperçu avec son nom et sa batterie, et prévient quand elle tombe à 15 % ou moins. Quiera lit le niveau que Windows connaît : un appareil qui ne le transmet pas à Windows n'aura pas de pourcentage.",
          ],
        },
      ],
    },
    en: {
      title: "See your Bluetooth headphones', keyboard's or mouse's battery on Windows",
      description: "Where Windows shows Bluetooth devices' battery level, and how to get warned when it's low.",
      intro: "The headset cuts out mid-meeting, the mouse dies at the worst time. Windows often knows their battery, if you can see it.",
      blocks: [
        { h2: "In Windows", p: ["Settings › Bluetooth & devices: the percentage shows next to devices that report it."] },
        {
          h2: "With Quiera",
          p: ["When a device connects, " + QEN + " shows a peek with its name and battery, and warns you when it drops to 15% or less. Quiera reads the level Windows knows: a device that doesn't report it to Windows won't have a percentage."],
        },
      ],
    },
  },
  {
    slug: "airpods-battery-windows",
    category: "devices",
    updated: "2026-11-08",
    related: ["bluetooth-headphones-battery-windows", "change-audio-output-windows", "volume-per-app-windows"],
    fr: {
      slug: "batterie-airpods-windows",
      title: "Voir la batterie des AirPods sur Windows",
      description: "Pourquoi Windows affiche rarement la batterie des AirPods, et les solutions possibles sur PC.",
      intro: "Les AirPods se connectent bien à un PC Windows, mais leur batterie y est souvent invisible.",
      blocks: [
        {
          h2: "Pourquoi",
          p: ["Les AirPods annoncent leur batterie d'une façon propre à Apple, que Windows ne lit généralement pas : Paramètres › Bluetooth et appareils n'affiche alors aucun pourcentage."],
        },
        {
          h2: "Les solutions",
          list: [
            "Regarder la batterie sur un iPhone, ou sur le boîtier (voyant).",
            "Des applis tierces pour Windows lisent les annonces Bluetooth des AirPods (par exemple MagicPods).",
          ],
          p: [Q + " affiche la batterie que Windows connaît : pour des AirPods, elle est souvent absente. Pour la plupart des casques et claviers, en revanche, l'aperçu s'affiche à la connexion."],
        },
      ],
    },
    en: {
      title: "See AirPods' battery on Windows",
      description: "Why Windows rarely shows AirPods' battery, and the options on PC.",
      intro: "AirPods connect fine to a Windows PC, but their battery is often invisible there.",
      blocks: [
        { h2: "Why", p: ["AirPods report their battery in an Apple-specific way that Windows usually doesn't read: Settings › Bluetooth & devices then shows no percentage."] },
        {
          h2: "The options",
          list: ["Check the battery on an iPhone, or on the case (light).", "Third-party Windows apps read AirPods' Bluetooth announcements (for example MagicPods)."],
          p: [QEN + " shows the battery Windows knows: for AirPods, it's often missing. For most headsets and keyboards, though, the peek shows on connection."],
        },
      ],
    },
  },
  {
    slug: "caps-lock-indicator-windows",
    category: "devices",
    updated: "2026-11-08",
    related: ["bluetooth-headphones-battery-windows", "windows-notifications-island", "hide-island-in-games"],
    fr: {
      slug: "afficher-verr-maj-ecran",
      title: "Afficher Verr. Maj à l'écran sur Windows",
      description: "Savoir si Verr. Maj est activé sans regarder le clavier : un indicateur à l'écran sur PC.",
      intro: "Beaucoup de claviers n'ont pas de voyant Verr. Maj, et Windows n'affiche rien par défaut.",
      blocks: [
        {
          h2: "Avec Quiera",
          p: ["À chaque appui sur Verr. Maj, " + Q + " affiche un court aperçu « Verr. Maj » activé ou désactivé, en haut de l'écran. Il se coupe dans Réglages › Aperçus, comme ceux du volume, du chargeur et des appareils audio."],
        },
      ],
    },
    en: {
      title: "Show Caps Lock on screen on Windows",
      description: "Know whether Caps Lock is on without looking at the keyboard: an on-screen indicator on PC.",
      intro: "Many keyboards have no Caps Lock light, and Windows shows nothing by default.",
      blocks: [
        { h2: "With Quiera", p: ["Each time you press Caps Lock, " + QEN + " shows a short “Caps Lock” on or off peek at the top of the screen. It can be turned off in Settings › Peeks, like the volume, charger and audio device ones."] },
      ],
    },
  },
  {
    slug: "windows-notifications-island",
    category: "devices",
    updated: "2026-11-08",
    related: ["customize-island-tabs", "caps-lock-indicator-windows", "claude-code-notifications"],
    fr: {
      slug: "notifications-windows-haut-ecran",
      title: "Des notifications Windows plus discrètes, en haut de l'écran",
      description: "Recevoir les notifications de Windows dans une Dynamic Island plutôt qu'en bas à droite, et les retrouver ensuite.",
      intro: "Les notifications de Windows surgissent en bas à droite et disparaissent. Elles peuvent passer en haut, plus discrètes.",
      blocks: [
        {
          h2: "Avec Quiera",
          steps: [
            "Active « Notifications dans l'île » dans Réglages › Notifications : Windows demande alors ton accord pour que Quiera les lise.",
            "Chaque notification passe quelques secondes sur l'île, puis reste dans l'onglet Notifications.",
            "Un clic ouvre l'appli concernée ; la croix la retire.",
          ],
          p: ["Le mode Ne pas déranger de Windows est respecté. Répondre directement depuis l'île n'est pas possible : Windows ne le permet pas aux applis tierces."],
        },
      ],
    },
    en: {
      title: "Quieter Windows notifications, at the top of the screen",
      description: "Get Windows' notifications in a Dynamic Island instead of the bottom right, and find them again later.",
      intro: "Windows' notifications pop up at the bottom right and vanish. They can move to the top, more discreetly.",
      blocks: [
        {
          h2: "With Quiera",
          steps: ["Turn on “Notifications in the island” in Settings › Notifications: Windows then asks you to let Quiera read them.", "Each notification passes over the island for a few seconds, then stays in the Notifications tab.", "A click opens the app; the cross dismisses it."],
          p: ["Windows' Do Not Disturb is respected. Replying from the island isn't possible: Windows doesn't allow it for third-party apps."],
        },
      ],
    },
  },
  {
    slug: "wifi-bluetooth-quick-toggle",
    category: "devices",
    updated: "2026-11-08",
    related: ["change-audio-output-windows", "volume-per-app-windows", "bluetooth-headphones-battery-windows"],
    fr: {
      slug: "couper-wifi-bluetooth-windows",
      title: "Couper le Wi-Fi ou le Bluetooth en un clic sur Windows",
      description: "Activer ou désactiver le Wi-Fi et le Bluetooth rapidement sur Windows 11 : le centre de contrôle, et des boutons dans la Dynamic Island.",
      intro: "Couper le Bluetooth pour économiser la batterie, relancer le Wi-Fi qui bloque : ça devrait se faire en un clic.",
      blocks: [
        {
          h2: "Avec Windows 11",
          p: ["**Win+A** ouvre les paramètres rapides : les boutons Wi-Fi et Bluetooth s'y trouvent. Un clic sur la flèche à côté liste les réseaux ou les appareils."],
        },
        {
          h2: "Avec Quiera",
          p: ["L'onglet Contrôles de " + Q + " a deux boutons, Wi-Fi et Bluetooth, à côté du volume et de la sortie audio : un clic les active ou les coupe."],
        },
      ],
    },
    en: {
      title: "Turn Wi-Fi or Bluetooth off in one click on Windows",
      description: "Turn Wi-Fi and Bluetooth on or off fast on Windows 11: quick settings, and buttons in the Dynamic Island.",
      intro: "Turning Bluetooth off to save battery, restarting a stuck Wi-Fi: it should take one click.",
      blocks: [
        { h2: "With Windows 11", p: ["**Win+A** opens quick settings: the Wi-Fi and Bluetooth buttons are there. The arrow next to them lists networks or devices."] },
        { h2: "With Quiera", p: [QEN + "'s Controls tab has two buttons, Wi-Fi and Bluetooth, next to the volume and audio output: a click turns them on or off."] },
      ],
    },
  },
  {
    slug: "laptop-charging-indicator",
    category: "devices",
    updated: "2026-11-08",
    related: ["bluetooth-headphones-battery-windows", "caps-lock-indicator-windows", "dynamic-island-windows"],
    fr: {
      slug: "pc-portable-en-charge",
      title: "Savoir si le PC portable charge vraiment, d'un coup d'œil",
      description: "Vérifier que le chargeur est bien branché sur un PC portable Windows : l'icône de la batterie, et un aperçu à l'écran à chaque branchement.",
      intro: "Le câble est branché… mais le PC charge-t-il ? Une prise mal enfoncée et la batterie se vide en silence.",
      blocks: [
        {
          h2: "Dans Windows",
          p: ["L'icône de batterie de la barre des tâches affiche une prise quand le PC est sur secteur ; Paramètres › Système › Alimentation et batterie donne le détail."],
        },
        {
          h2: "Avec Quiera",
          p: ["À chaque branchement ou débranchement, " + Q + " affiche un court aperçu « En charge » ou « Sur batterie » avec le pourcentage. Il se coupe dans Réglages › Aperçus."],
        },
      ],
    },
    en: {
      title: "Know whether your laptop is really charging, at a glance",
      description: "Check that the charger is plugged in on a Windows laptop: the battery icon, and an on-screen peek each time you plug in.",
      intro: "The cable is in… but is the PC charging? A loose plug and the battery drains silently.",
      blocks: [
        { h2: "In Windows", p: ["The taskbar battery icon shows a plug when the PC is on mains power; Settings › System › Power & battery gives the details."] },
        { h2: "With Quiera", p: ["Each time you plug in or unplug, " + QEN + " shows a short “Charging” or “On battery” peek with the percentage. It can be turned off in Settings › Peeks."] },
      ],
    },
  },
  {
    slug: "windows-protected-your-pc",
    category: "island",
    updated: "2026-11-08",
    related: ["dynamic-island-windows", "free-dynamic-island-windows-11", "hide-island-in-games"],
    fr: {
      slug: "windows-a-protege-votre-ordinateur",
      title: "« Windows a protégé votre ordinateur » : que faire ?",
      description: "Pourquoi Windows SmartScreen bloque certains installateurs, comment vérifier qu'un fichier est sûr, et comment l'exécuter quand même.",
      intro: "Au lancement d'un installateur téléchargé, un écran bleu dit « Windows a protégé votre ordinateur ». Ce n'est pas forcément un virus.",
      blocks: [
        {
          h2: "Pourquoi ce message",
          p: ["SmartScreen, le filtre de Windows, affiche cet avertissement pour les programmes qu'il voit rarement ou qui ne sont pas signés par un certificat reconnu. Les petits logiciels, et notamment beaucoup de logiciels libres, le déclenchent souvent."],
        },
        {
          h2: "Avant de continuer",
          list: [
            "Télécharge le fichier **depuis le site officiel** de son auteur, pas d'un site de téléchargement tiers.",
            "Si le code est public (GitHub), le fichier doit venir de la page **Releases** du projet.",
            "En cas de doute, analyse-le avec Microsoft Defender (clic droit › Analyser) ou sur VirusTotal.",
          ],
        },
        {
          h2: "L'exécuter quand même",
          steps: ["Clique sur « Informations complémentaires ».", "Vérifie le nom du programme et l'éditeur affichés.", "Clique sur « Exécuter quand même »."],
          p: ["L'installateur de " + Q + " n'est pas encore signé : ce message est attendu. Il se télécharge depuis quiera.eu ou la page Releases de GitHub, où son code est public."],
        },
      ],
    },
    en: {
      title: "“Windows protected your PC”: what to do?",
      description: "Why Windows SmartScreen blocks some installers, how to check a file is safe, and how to run it anyway.",
      intro: "When you open a downloaded installer, a blue screen says “Windows protected your PC”. It's not necessarily a virus.",
      blocks: [
        { h2: "Why this message", p: ["SmartScreen, Windows' filter, shows this warning for programs it rarely sees or that aren't signed with a recognised certificate. Small programs, and many open-source ones, often trigger it."] },
        {
          h2: "Before going on",
          list: [
            "Download the file **from its maker's official site**, not a third-party download site.",
            "If the code is public (GitHub), the file should come from the project's **Releases** page.",
            "If in doubt, scan it with Microsoft Defender (right-click › Scan) or on VirusTotal.",
          ],
        },
        {
          h2: "Run it anyway",
          steps: ["Click “More info”.", "Check the program name and publisher shown.", "Click “Run anyway”."],
          p: [QEN + "'s installer isn't signed yet: this message is expected. Download it from quiera.eu or the GitHub Releases page, where its code is public."],
        },
      ],
    },
  },
];
