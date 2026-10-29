/**
 * What the demo island shows. Songs, lyrics, people and files are all
 * invented: the page shows how Quiera looks, not anyone's content.
 */

export interface LyricLine {
  start: number;
  end: number;
  words: string[];
}

export interface Track {
  title: string;
  artist: string;
  durationMs: number;
  cover: string;
  lyrics: LyricLine[] | null;
}

/** Lines repeated over the whole song, one every `every` ms. */
function lyrics(lines: string[], durationMs: number, every: number): LyricLine[] {
  const out: LyricLine[] = [{ start: 0, end: every, words: ["♪"] }];
  for (let i = 1; i * every < durationMs; i++) {
    out.push({ start: i * every, end: (i + 1) * every, words: lines[(i - 1) % lines.length].split(" ") });
  }
  return out;
}

export const TRACKS: Track[] = [
  {
    title: "Néons",
    artist: "Les Nuits Claires",
    durationMs: 195_000,
    cover: "radial-gradient(circle at 30% 25%, #ffb36b 0, transparent 45%), radial-gradient(circle at 75% 80%, #ff4f8b 0, transparent 50%), linear-gradient(135deg, #3a1c71, #d76d77 60%, #ffaf7b)",
    lyrics: lyrics(
      [
        "Les rues s'allument une à une",
        "On marche sans savoir où",
        "La ville respire sous la lune",
        "Et la nuit n'est qu'à nous",
        "On danse sous les néons",
        "Les couleurs plein les yeux",
        "On oublie jusqu'à nos noms",
        "Le ciel devient lumineux",
      ],
      195_000,
      3600,
    ),
  },
  {
    title: "Minuit sur la ville",
    artist: "Orage Doux",
    durationMs: 222_000,
    cover: "radial-gradient(circle at 70% 30%, #9be7ff 0, transparent 40%), linear-gradient(160deg, #0f2027, #203a43 50%, #2c7da0)",
    lyrics: lyrics(
      [
        "Il est minuit sur la ville",
        "Les fenêtres parlent bas",
        "Tout paraît simple et fragile",
        "Quand tu marches avec moi",
        "Les voitures font des vagues",
        "Sur le bitume mouillé",
      ],
      222_000,
      4000,
    ),
  },
  {
    title: "Bleu outremer",
    artist: "Saison Basse",
    durationMs: 178_000,
    cover: "radial-gradient(circle at 30% 70%, #4facfe 0, transparent 50%), linear-gradient(200deg, #00c6fb, #005bea)",
    lyrics: null,
  },
];

export interface DemoNotification {
  id: number;
  app: string;
  letter: string;
  color: string;
  title: string;
  body: string;
  minutesAgo: number;
}

let nextId = 1;
const NOTIFICATIONS: Omit<DemoNotification, "id" | "minutesAgo">[] = [
  { app: "Discord", letter: "D", color: "#5865f2", title: "Léa", body: "On se retrouve à 20 h devant le ciné ?" },
  { app: "Outlook", letter: "O", color: "#0a64c9", title: "Point d'équipe déplacé", body: "La réunion de demain passe à 15 h 30, même salle." },
  { app: "WhatsApp", letter: "W", color: "#1fa855", title: "Maman", body: "Tu rentres pour le dîner ce soir ?" },
  { app: "Steam", letter: "S", color: "#1b2838", title: "Téléchargement terminé", body: "Votre jeu est installé et prêt à être lancé." },
  { app: "Teams", letter: "T", color: "#5b5fc7", title: "Hugo a partagé un fichier", body: "maquette-v3.fig · « Dis-moi ce que tu en penses »" },
];

export function makeNotification(index: number): DemoNotification {
  return { ...NOTIFICATIONS[index % NOTIFICATIONS.length], id: nextId++, minutesAgo: 0 };
}

export function initialNotifications(): DemoNotification[] {
  return [makeNotification(1), makeNotification(2)].map((n, i) => ({ ...n, minutesAgo: 4 + i * 9 }));
}

export type LaunchKind = "app" | "image" | "video" | "music" | "document";

export interface LaunchItem {
  kind: LaunchKind;
  title: string;
  sub?: string;
  letter?: string;
  color?: string;
}

export const APPS: LaunchItem[] = [
  { kind: "app", title: "Spotify", letter: "S", color: "#1db954" },
  { kind: "app", title: "Discord", letter: "D", color: "#5865f2" },
  { kind: "app", title: "Google Chrome", letter: "C", color: "#e8a317" },
  { kind: "app", title: "Explorateur de fichiers", letter: "E", color: "#e9b949" },
  { kind: "app", title: "Visual Studio Code", letter: "V", color: "#1f8ad2" },
  { kind: "app", title: "Bloc-notes", letter: "B", color: "#3a7bd5" },
  { kind: "app", title: "Paint", letter: "P", color: "#e0457b" },
  { kind: "app", title: "Calculatrice", letter: "C", color: "#4a4a52" },
  { kind: "app", title: "Paramètres", letter: "P", color: "#5a5a64" },
  { kind: "app", title: "Steam", letter: "S", color: "#1b2838" },
  { kind: "app", title: "Microsoft Word", letter: "W", color: "#2b579a" },
  { kind: "app", title: "Microsoft Excel", letter: "X", color: "#217346" },
];

export const FILES: LaunchItem[] = [
  { kind: "document", title: "rapport-de-stage.pdf", sub: "Documents · hier" },
  { kind: "document", title: "Rapport budget 2026.xlsx", sub: "D:\\Projets · 12 oct." },
  { kind: "image", title: "vacances-plage.jpg", sub: "Images · 14 août" },
  { kind: "image", title: "photo-du-chat.png", sub: "Bureau · lundi" },
  { kind: "image", title: "capture-ecran-2026.png", sub: "Images\\Captures · aujourd'hui" },
  { kind: "video", title: "cours-de-maths.mp4", sub: "Vidéos · 2 oct." },
  { kind: "video", title: "anniversaire-mamie.mov", sub: "D:\\Souvenirs · 3 juin" },
  { kind: "music", title: "playlist-ete.mp3", sub: "Musique · 21 juil." },
  { kind: "document", title: "CV-2026.docx", sub: "Documents · 9 sept." },
  { kind: "document", title: "notes-reunion.txt", sub: "Bureau · aujourd'hui" },
];

export interface AppVolume {
  name: string;
  letter: string;
  color: string;
  level: number;
  muted: boolean;
}

export const OUTPUTS = ["Haut-parleurs", "Casque sans fil", "Écran HDMI"];

export const APP_VOLUMES: AppVolume[] = [
  { name: "Spotify", letter: "S", color: "#1db954", level: 80, muted: false },
  { name: "Discord", letter: "D", color: "#5865f2", level: 45, muted: false },
  { name: "Google Chrome", letter: "C", color: "#e8a317", level: 100, muted: false },
];

export type ClipKind = "text" | "link";

export interface ClipItem {
  id: number;
  kind: ClipKind;
  text: string;
  minutesAgo: number;
}

let nextClip = 1;
export function makeClip(text: string, minutesAgo = 0): ClipItem {
  const kind: ClipKind = /^https?:\/\/\S+$/.test(text.trim()) ? "link" : "text";
  return { id: nextClip++, kind, text: text.trim(), minutesAgo };
}

export const INITIAL_CLIPS = [
  makeClip("https://github.com/quierapro/quiera-island", 2),
  makeClip("Rendez-vous jeudi 14 h, 12 rue des Lilas, 2e étage.", 6),
  makeClip("Merci pour ton retour, je corrige ça ce soir !", 15),
];

/** A desktop file the visitor can drag onto the island. */
export interface DesktopFile {
  name: string;
  size: number;
  kind: "image" | "document" | "music";
}

export const DESKTOP_FILES: DesktopFile[] = [
  { name: "vacances.jpg", size: 2_480_000, kind: "image" },
  { name: "rapport.pdf", size: 812_000, kind: "document" },
  { name: "playlist-ete.mp3", size: 6_200_000, kind: "music" },
];
