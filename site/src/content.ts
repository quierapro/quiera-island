/** Text and links shared by the page and its prerender (structured data). */

export const REPO = "https://github.com/quierapro/quiera-island";
export const RELEASES = `${REPO}/releases`;
/** The installer of the latest release, under a name that stays the same from one version to the next. */
export const DOWNLOAD = `${REPO}/releases/latest/download/Quiera-Setup-x64.exe`;

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce que Quiera ?",
    a: "Une Dynamic Island pour PC Windows : une petite pilule noire en haut de l'écran, qui s'agrandit pour afficher ce qui se passe (musique, notifications, aperçus) et s'ouvre au survol pour vous donner le lecteur, les contrôles, le Shelf et le presse-papiers. Alt+Espace en fait un lanceur.",
  },
  {
    q: "Sur quels systèmes fonctionne-t-il ?",
    a: "Windows 11. Windows 10 devrait fonctionner mais n'est pas encore testé. Les versions Linux et macOS sont en préparation : elles ne sont pas encore disponibles.",
  },
  {
    q: "Comment installer Quiera ?",
    a: "Téléchargez l'installateur pour Windows, lancez-le, et l'île apparaît en haut de l'écran. Aucun compte n'est demandé. Pour qu'elle démarre avec Windows, activez « Lancer au démarrage de Windows » dans les réglages. Pour la désinstaller, passez par Paramètres › Applications, comme pour toute appli.",
  },
  {
    q: "Windows affiche « Windows a protégé votre ordinateur » : est-ce normal ?",
    a: "Oui. L'installateur n'est pas encore signé par un certificat payant, et SmartScreen avertit pour tout logiciel récent dans ce cas. Cliquez sur « Informations complémentaires », puis « Exécuter quand même ». Le code est public sur GitHub, et chaque installateur est compilé par GitHub Actions directement à partir de ce code.",
  },
  {
    q: "D'où viennent les paroles ?",
    a: "De LRCLIB, une base de paroles synchronisées ouverte et gratuite. Seuls le titre, l'artiste, l'album et la durée du morceau sont envoyés pour les trouver. Une source mot à mot (NetEase) peut être activée dans les réglages ; elle est coupée par défaut, car son service n'est pas officiel.",
  },
  {
    q: "Quelles notifications s'affichent ?",
    a: "Celles que Windows affiche, une fois que vous avez autorisé Quiera à les lire. Un clic ouvre l'appli concernée. Répondre directement depuis l'île n'est pas possible : Windows ne le permet pas aux applis tierces.",
  },
  {
    q: "Est-ce que Quiera ralentit mon PC ou mes jeux ?",
    a: "Non. L'île se cache quand un jeu ou une vidéo passe en plein écran, et elle ne consomme alors presque rien. Au repos, Quiera utilise quelques millisecondes de processeur par seconde, et la mémoire de son affichage est réduite dès que l'île se referme.",
  },
  {
    q: "Mes données restent-elles sur mon PC ?",
    a: "Oui. Pas de compte, pas de publicité, pas de télémétrie. L'historique du presse-papiers et les notifications sont gardés en mémoire seulement, et disparaissent à la fermeture. La seule chose envoyée sur Internet est la recherche de paroles décrite plus haut.",
  },
  {
    q: "Comment changer le raccourci ou couper un module ?",
    a: "Ouvrez les réglages depuis l'icône de Quiera dans la barre des tâches (« Réglages… »), ou tapez « réglages » dans le lanceur. Chaque changement s'applique tout de suite, sans redémarrer.",
  },
  {
    q: "Quiera est-il vraiment gratuit ?",
    a: "Oui, et libre : le code est publié sur GitHub sous licence GPL-3.0. Vous pouvez le lire, le compiler vous-même et proposer des améliorations.",
  },
];
