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

/**
 * A real QR code, made by Quiera's own code (src-tauri/src/share.rs): in the
 * demo, sending to the phone shows it, and it opens this site.
 */
export const SITE_QR = {
  size: 25,
  path: "M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM8 0h1v1h-1zM9 0h1v1h-1zM11 0h1v1h-1zM14 0h1v1h-1zM16 0h1v1h-1zM18 0h1v1h-1zM19 0h1v1h-1zM20 0h1v1h-1zM21 0h1v1h-1zM22 0h1v1h-1zM23 0h1v1h-1zM24 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM10 1h1v1h-1zM11 1h1v1h-1zM12 1h1v1h-1zM13 1h1v1h-1zM14 1h1v1h-1zM16 1h1v1h-1zM18 1h1v1h-1zM24 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM9 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM13 2h1v1h-1zM15 2h1v1h-1zM18 2h1v1h-1zM20 2h1v1h-1zM21 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM16 3h1v1h-1zM18 3h1v1h-1zM20 3h1v1h-1zM21 3h1v1h-1zM22 3h1v1h-1zM24 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM11 4h1v1h-1zM14 4h1v1h-1zM18 4h1v1h-1zM20 4h1v1h-1zM21 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM10 5h1v1h-1zM11 5h1v1h-1zM12 5h1v1h-1zM13 5h1v1h-1zM14 5h1v1h-1zM16 5h1v1h-1zM18 5h1v1h-1zM24 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM21 6h1v1h-1zM22 6h1v1h-1zM23 6h1v1h-1zM24 6h1v1h-1zM9 7h1v1h-1zM10 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM16 7h1v1h-1zM0 8h1v1h-1zM2 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM13 8h1v1h-1zM15 8h1v1h-1zM16 8h1v1h-1zM19 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM1 9h1v1h-1zM3 9h1v1h-1zM5 9h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1zM11 9h1v1h-1zM15 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM21 9h1v1h-1zM23 9h1v1h-1zM24 9h1v1h-1zM1 10h1v1h-1zM2 10h1v1h-1zM3 10h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM11 10h1v1h-1zM12 10h1v1h-1zM13 10h1v1h-1zM14 10h1v1h-1zM15 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM21 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM0 11h1v1h-1zM2 11h1v1h-1zM3 11h1v1h-1zM4 11h1v1h-1zM7 11h1v1h-1zM9 11h1v1h-1zM10 11h1v1h-1zM14 11h1v1h-1zM15 11h1v1h-1zM16 11h1v1h-1zM17 11h1v1h-1zM21 11h1v1h-1zM0 12h1v1h-1zM1 12h1v1h-1zM5 12h1v1h-1zM6 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM13 12h1v1h-1zM14 12h1v1h-1zM16 12h1v1h-1zM18 12h1v1h-1zM24 12h1v1h-1zM2 13h1v1h-1zM3 13h1v1h-1zM7 13h1v1h-1zM13 13h1v1h-1zM14 13h1v1h-1zM15 13h1v1h-1zM18 13h1v1h-1zM19 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM0 14h1v1h-1zM1 14h1v1h-1zM3 14h1v1h-1zM4 14h1v1h-1zM5 14h1v1h-1zM6 14h1v1h-1zM7 14h1v1h-1zM8 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1zM15 14h1v1h-1zM17 14h1v1h-1zM21 14h1v1h-1zM22 14h1v1h-1zM24 14h1v1h-1zM2 15h1v1h-1zM4 15h1v1h-1zM7 15h1v1h-1zM8 15h1v1h-1zM13 15h1v1h-1zM17 15h1v1h-1zM19 15h1v1h-1zM20 15h1v1h-1zM21 15h1v1h-1zM0 16h1v1h-1zM1 16h1v1h-1zM2 16h1v1h-1zM3 16h1v1h-1zM5 16h1v1h-1zM6 16h1v1h-1zM7 16h1v1h-1zM9 16h1v1h-1zM11 16h1v1h-1zM12 16h1v1h-1zM13 16h1v1h-1zM15 16h1v1h-1zM16 16h1v1h-1zM17 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM20 16h1v1h-1zM23 16h1v1h-1zM8 17h1v1h-1zM12 17h1v1h-1zM16 17h1v1h-1zM20 17h1v1h-1zM24 17h1v1h-1zM0 18h1v1h-1zM1 18h1v1h-1zM2 18h1v1h-1zM3 18h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM8 18h1v1h-1zM12 18h1v1h-1zM13 18h1v1h-1zM14 18h1v1h-1zM16 18h1v1h-1zM18 18h1v1h-1zM20 18h1v1h-1zM24 18h1v1h-1zM0 19h1v1h-1zM6 19h1v1h-1zM9 19h1v1h-1zM10 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM15 19h1v1h-1zM16 19h1v1h-1zM20 19h1v1h-1zM24 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM3 20h1v1h-1zM4 20h1v1h-1zM6 20h1v1h-1zM13 20h1v1h-1zM14 20h1v1h-1zM15 20h1v1h-1zM16 20h1v1h-1zM17 20h1v1h-1zM18 20h1v1h-1zM19 20h1v1h-1zM20 20h1v1h-1zM23 20h1v1h-1zM24 20h1v1h-1zM0 21h1v1h-1zM2 21h1v1h-1zM3 21h1v1h-1zM4 21h1v1h-1zM6 21h1v1h-1zM9 21h1v1h-1zM13 21h1v1h-1zM14 21h1v1h-1zM16 21h1v1h-1zM17 21h1v1h-1zM20 21h1v1h-1zM22 21h1v1h-1zM23 21h1v1h-1zM0 22h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM4 22h1v1h-1zM6 22h1v1h-1zM8 22h1v1h-1zM9 22h1v1h-1zM11 22h1v1h-1zM15 22h1v1h-1zM16 22h1v1h-1zM17 22h1v1h-1zM19 22h1v1h-1zM20 22h1v1h-1zM21 22h1v1h-1zM23 22h1v1h-1zM24 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM10 23h1v1h-1zM13 23h1v1h-1zM15 23h1v1h-1zM16 23h1v1h-1zM17 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM0 24h1v1h-1zM1 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM8 24h1v1h-1zM9 24h1v1h-1zM11 24h1v1h-1zM12 24h1v1h-1zM13 24h1v1h-1zM16 24h1v1h-1zM18 24h1v1h-1zM21 24h1v1h-1zM24 24h1v1h-1z",
};
