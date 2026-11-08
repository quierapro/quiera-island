/** Text and links shared by the page and its prerender (structured data). */
import { translate, type Lang } from "./i18n";

export const REPO = "https://github.com/quierapro/quiera-island";
export const RELEASES = `${REPO}/releases`;
/** The installer of the latest release, under a name that stays the same from one version to the next. */
export const DOWNLOAD = `${REPO}/releases/latest/download/Quiera-Setup-x64.exe`;

/** The command that installs Quiera from Microsoft's package manager. */
export const WINGET = "winget install Quierapro.Quiera";
/**
 * Whether winget knows Quiera yet. Set to true once Microsoft has merged the
 * manifest (microsoft/winget-pkgs#471557): the page then offers the command.
 */
export const WINGET_READY = false;

export function faqs(lang: Lang): { q: string; a: string }[] {
  const tr = translate(lang);
  return [
    {
      q: tr("Qu'est-ce que Quiera ?", "What is Quiera?"),
      a: tr(
        "Une Dynamic Island pour PC Windows : une petite pilule noire en haut de l'écran, qui s'agrandit pour afficher ce qui se passe (musique, réunions, minuteur, notifications, aperçus) et s'ouvre au survol pour vous donner le lecteur, l'agenda, les contrôles, le Shelf et le presse-papiers. Alt+Espace en fait un lanceur.",
        "A Dynamic Island for Windows PCs: a small black pill at the top of the screen that grows to show what's going on (music, meetings, timer, notifications, peeks) and opens on hover to give you the player, your calendar, the controls, the Shelf and the clipboard. Alt+Space turns it into a launcher.",
      ),
    },
    {
      q: tr("Sur quels systèmes fonctionne-t-il ?", "Which systems does it run on?"),
      a: tr(
        "Windows 11. Windows 10 devrait fonctionner mais n'est pas encore testé. Les versions Linux et macOS sont en préparation : elles ne sont pas encore disponibles.",
        "Windows 11. Windows 10 should work but isn't tested yet. Linux and macOS versions are in the works: they aren't available yet.",
      ),
    },
    {
      q: tr("Comment installer Quiera ?", "How do I install Quiera?"),
      a: tr(
        "Téléchargez l'installateur pour Windows, lancez-le, et l'île apparaît en haut de l'écran. Aucun compte n'est demandé. Pour qu'elle démarre avec Windows, activez « Lancer au démarrage de Windows » dans les réglages. Pour la désinstaller, passez par Paramètres › Applications, comme pour toute appli.",
        "Download the installer for Windows, run it, and the island appears at the top of the screen. No account needed. To start it with Windows, turn on “Launch at Windows startup” in the settings. To uninstall it, go to Settings › Apps, as for any app.",
      ),
    },
    {
      q: tr("Peut-on l'installer avec winget ?", "Can I install it with winget?"),
      a: WINGET_READY
        ? tr(
            `Oui : ouvrez un terminal et tapez « ${WINGET} ». winget télécharge l'installateur depuis GitHub, vérifie son empreinte et l'installe, sans l'avertissement de SmartScreen. « winget upgrade Quierapro.Quiera » le met à jour.`,
            `Yes: open a terminal and type “${WINGET}”. winget downloads the installer from GitHub, checks its fingerprint and installs it, without the SmartScreen warning. “winget upgrade Quierapro.Quiera” updates it.`,
          )
        : tr(
            `Bientôt : Quiera est en cours de validation dans le catalogue de winget, le gestionnaire de paquets de Microsoft. Une fois accepté, « ${WINGET} » l'installera sans l'avertissement de SmartScreen. En attendant, l'installateur se télécharge ici.`,
            `Soon: Quiera is being reviewed for winget's catalogue, Microsoft's package manager. Once accepted, “${WINGET}” will install it without the SmartScreen warning. Until then, the installer is downloaded here.`,
          ),
    },
    {
      q: tr("Windows affiche « Windows a protégé votre ordinateur » : est-ce normal ?", "Windows says “Windows protected your PC”: is that normal?"),
      a: tr(
        "Oui. L'installateur n'est pas encore signé par un certificat payant, et SmartScreen avertit pour tout logiciel récent dans ce cas. Cliquez sur « Informations complémentaires », puis « Exécuter quand même ». Le code est public sur GitHub, et chaque installateur est compilé par GitHub Actions directement à partir de ce code.",
        "Yes. The installer isn't signed with a paid certificate yet, and SmartScreen warns about any recent software in that case. Click “More info”, then “Run anyway”. The code is public on GitHub, and every installer is built by GitHub Actions straight from that code.",
      ),
    },
    {
      q: tr("Comment ajouter mon agenda, et que devient-il ?", "How do I add my calendar, and what happens to it?"),
      a: tr(
        "Dans Réglages › Agenda, collez le lien iCal privé de votre agenda (Google Agenda, Outlook, iCloud…). Quiera le télécharge directement depuis votre fournisseur, tous les quarts d'heure, et garde les événements sur votre PC. Rien ne passe par un serveur de Quiera, et le lien n'apparaît jamais dans le journal. Quelques minutes avant une réunion, l'île l'annonce, avec un bouton Rejoindre pour Teams, Meet, Zoom ou Webex.",
        "In Settings › Calendar, paste your calendar's private iCal link (Google Calendar, Outlook, iCloud…). Quiera downloads it straight from your provider every 15 minutes and keeps the events on your PC. Nothing goes through a Quiera server, and the link never shows up in the log. A few minutes before a meeting, the island announces it, with a Join button for Teams, Meet, Zoom or Webex.",
      ),
    },
    {
      q: tr("Quiera marche-t-il avec Claude Code ?", "Does Quiera work with Claude Code?"),
      a: tr(
        "Oui. Dans Réglages › Agents IA, activez Claude Code (l'île le propose aussi la première fois qu'elle le voit tourner). L'île montre ce que fait chaque session, dans le terminal comme dans VS Code. Quand Claude demande une autorisation ou vous pose une question, l'île vous la pose, avec la commande exacte ou le code : Autoriser, Refuser, répondre, ou la renvoyer au terminal. Rien ne quitte votre PC : ni vos messages, ni le contenu de vos fichiers.",
        "Yes. In Settings › AI agents, turn on Claude Code (the island also offers it the first time it sees it running). The island shows what each session is doing, in the terminal as in VS Code. When Claude asks for a permission or a question, the island asks you, with the exact command or the code: Allow, Deny, answer, or send it back to the terminal. Nothing leaves your PC: neither your messages nor your files' content.",
      ),
    },
    {
      q: tr("Comment voir la batterie de mon casque, clavier ou souris ?", "How do I see my headphones', keyboard's or mouse's battery?"),
      a: tr(
        "Connectez l'appareil en Bluetooth : à sa connexion, l'île affiche son nom et sa batterie, et prévient quand elle passe sous 15 %. Cela marche avec les appareils qui donnent leur niveau à Windows (celui que montre Paramètres › Bluetooth).",
        "Connect the device over Bluetooth: when it connects, the island shows its name and battery, and warns you when it drops below 15%. This works with devices that report their level to Windows (the one shown in Settings › Bluetooth).",
      ),
    },
    {
      q: tr("L'île me gêne en jeu ou cache un onglet : que faire ?", "The island gets in the way in a game or hides a tab: what can I do?"),
      a: tr(
        "En plein écran, elle se cache toute seule. Ctrl+Alt+I l'affiche ou la cache à tout moment, même en jeu ; dans Réglages › Général, vous choisissez votre raccourci : une combinaison, une seule touche, ou une touche pressée deux fois. Fermée, l'île laisse passer les clics vers ce qu'il y a dessous, et s'ouvre quand la souris s'y pose.",
        "In fullscreen, it hides by itself. Ctrl+Alt+I shows or hides it at any time, even in a game; in Settings › General, you pick your own shortcut: a combination, a single key, or a key pressed twice. Closed, the island lets clicks through to what lies below, and opens when the pointer rests on it.",
      ),
    },
    {
      q: tr("Comment envoyer un fichier sur mon téléphone ?", "How do I send a file to my phone?"),
      a: tr(
        "Déposez-le sur l'île, puis « Envoyer au téléphone » dans le Shelf : un QR code s'affiche. Scannez-le avec l'appareil photo, sur le même Wi-Fi que le PC, et le fichier se télécharge, sur iPhone comme sur Android, sans appli. Rien ne passe par Internet et le lien ne marche que 10 minutes. « Partager avec Windows » ouvre aussi le panneau Partager de Windows.",
        "Drop it on the island, then “Send to phone” in the Shelf: a QR code appears. Scan it with the camera, on the same Wi-Fi as the PC, and the file downloads, on iPhone and Android alike, with no app. Nothing goes over the Internet and the link only works for 10 minutes. “Share with Windows” also opens Windows' Share panel.",
      ),
    },
    {
      q: tr("Comment Quiera se met-il à jour ?", "How does Quiera update?"),
      a: tr(
        "Quiera cherche une nouvelle version au démarrage puis toutes les 6 heures, et l'annonce sur l'île. Elle s'installe quand vous le décidez, depuis l'icône de Quiera dans la barre des tâches ou les réglages, après vérification de sa signature. La recherche se coupe dans Réglages › À propos.",
        "Quiera looks for a new version at start and every 6 hours, and announces it on the island. It installs when you decide, from Quiera's taskbar icon or the settings, once its signature is checked. The check can be turned off in Settings › About.",
      ),
    },
    {
      q: tr("D'où viennent les paroles ?", "Where do the lyrics come from?"),
      a: tr(
        "De LRCLIB, une base de paroles synchronisées ouverte et gratuite. Seuls le titre, l'artiste, l'album et la durée du morceau sont envoyés pour les trouver. Une source mot à mot (NetEase) peut être activée dans les réglages ; elle est coupée par défaut, car son service n'est pas officiel.",
        "From LRCLIB, an open and free database of synced lyrics. Only the track's title, artist, album and duration are sent to find them. A word-by-word source (NetEase) can be turned on in the settings; it's off by default, as its service isn't official.",
      ),
    },
    {
      q: tr("Quelles notifications s'affichent ?", "Which notifications show up?"),
      a: tr(
        "Celles que Windows affiche, une fois que vous avez autorisé Quiera à les lire. Un clic ouvre l'appli concernée. Répondre directement depuis l'île n'est pas possible : Windows ne le permet pas aux applis tierces.",
        "The ones Windows shows, once you've allowed Quiera to read them. A click opens the app. Replying straight from the island isn't possible: Windows doesn't allow it for third-party apps.",
      ),
    },
    {
      q: tr("Est-ce que Quiera ralentit mon PC ou mes jeux ?", "Does Quiera slow down my PC or my games?"),
      a: tr(
        "Non. L'île se cache quand un jeu ou une vidéo passe en plein écran, et elle ne consomme alors presque rien. Au repos, Quiera utilise quelques millisecondes de processeur par seconde, et la mémoire de son affichage est réduite dès que l'île se referme.",
        "No. The island hides when a game or a video goes fullscreen, and then uses almost nothing. At rest, Quiera uses a few milliseconds of CPU per second, and its display memory is trimmed as soon as the island closes.",
      ),
    },
    {
      q: tr("Mes données restent-elles sur mon PC ?", "Does my data stay on my PC?"),
      a: tr(
        "Oui. Pas de compte, pas de publicité, pas de télémétrie. L'historique du presse-papiers et les notifications sont gardés en mémoire seulement, et disparaissent à la fermeture ; le miroir n'enregistre rien. Seules trois choses passent par Internet : la recherche de paroles, la vérification des mises à jour (une simple lecture de la page des versions sur GitHub), et, si vous l'avez ajouté, votre agenda, téléchargé depuis son lien.",
        "Yes. No account, no advertising, no telemetry. The clipboard history and notifications are kept in memory only, and vanish when Quiera closes; the mirror records nothing. Only three things go over the Internet: the lyrics lookup, the update check (a plain read of the releases page on GitHub), and, if you added it, your calendar, downloaded from its link.",
      ),
    },
    {
      q: tr("Comment changer un raccourci ou couper un module ?", "How do I change a shortcut or turn a module off?"),
      a: tr(
        "Ouvrez les réglages depuis l'icône de Quiera dans la barre des tâches (« Réglages… »), ou tapez « réglages » dans le lanceur. Chaque changement s'applique tout de suite, sans redémarrer.",
        "Open the settings from Quiera's taskbar icon (“Settings…”), or type “settings” in the launcher. Every change applies at once, with no restart.",
      ),
    },
    {
      q: tr("Quiera est-il vraiment gratuit ?", "Is Quiera really free?"),
      a: tr(
        "Oui, et libre : le code est publié sur GitHub sous licence GPL-3.0. Vous pouvez le lire, le compiler vous-même et proposer des améliorations.",
        "Yes, and open source: the code is published on GitHub under the GPL-3.0 licence. You can read it, build it yourself and suggest improvements.",
      ),
    },
  ];
}
