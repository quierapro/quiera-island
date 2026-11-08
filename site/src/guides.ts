/**
 * The guides: pages on what Quiera touches (AI coding agents and their
 * limits here, everything else in ./guides-more.ts). Each guide exists in
 * French and in English; scripts/prerender.mjs turns them into static pages
 * at /guides/<slug>/ and /en/guides/<slug>/.
 *
 * Text conventions: [label](url) makes a link, **text** bold, `code` code.
 * Facts that change (prices, limits) say when they were read and link to
 * the official pages.
 */

export interface GuideBlock {
  h2: string;
  p?: string[];
  list?: string[];
  steps?: string[];
  code?: string;
}

export interface GuideText {
  /** Its address in this language, when it differs from the guide's slug. */
  slug?: string;
  /** The page's title (also the <title>). */
  title: string;
  /** The meta description: one or two sentences. */
  description: string;
  intro: string;
  blocks: GuideBlock[];
}

/** The guides' families, in the index's order (see GUIDE_CATEGORIES). */
export type GuideCategory = "island" | "music" | "productivity" | "files" | "calendar" | "devices" | "agents" | "usage";

export interface Guide {
  slug: string;
  category: GuideCategory;
  /** When its facts were last checked (YYYY-MM-DD). */
  updated: string;
  fr: GuideText;
  en: GuideText;
  related: string[];
}

import { MORE_GUIDES } from "./guides-more";

const DOWNLOAD = "https://github.com/quierapro/quiera-island/releases/latest/download/Quiera-Setup-x64.exe";
const DOCS = "https://github.com/quierapro/quiera-island/blob/main/docs/agents.md";

const AGENT_GUIDES: Guide[] = [
  {
    slug: "best-notch-apps",
    category: "agents",
    updated: "2026-11-08",
    related: ["approve-from-the-notch", "monitor-multiple-agents", "claude-code-notifications"],
    fr: {
      slug: "meilleures-apps-encoche-agents-ia",
      title: "Les meilleures apps « encoche » et Dynamic Island pour agents IA (Windows et Mac)",
      description: "Comparatif des apps qui affichent Claude Code et Codex dans une encoche ou une Dynamic Island : fonctions, plateformes, prix, et laquelle choisir sur Windows.",
      intro:
        "Depuis 2025, une vague d'apps met les agents de code (Claude Code, Codex…) dans l'encoche du Mac ou dans une petite île en haut de l'écran : on voit ce qu'ils font, quand ils attendent, et on leur répond sans changer de fenêtre. Voici ce qui existe, d'après les pages de leurs auteurs (relevé en novembre 2026).",
      blocks: [
        {
          h2: "Ce qu'on attend d'une bonne app",
          list: [
            "**L'état en direct** : travaille, attend ta réponse, a fini.",
            "**Autoriser ou refuser** une commande sans revenir au terminal, avec la commande exacte ou le code modifié sous les yeux.",
            "**Répondre aux questions** de l'agent et valider un plan.",
            "**Le quota** : la part utilisée de la limite de 5 h et de la semaine.",
            "**Revenir au terminal** d'un clic, et un **son** quand c'est fini.",
          ],
        },
        {
          h2: "Sur Mac",
          list: [
            "**Vibe Island** (payant) : 30 agents, autorisations avec raccourcis, plans en Markdown, retour à l'onglet exact du terminal, sons par événement.",
            "**Coucou** (open source) : nombreux agents, « Toujours autoriser », app iPhone avec Face ID pour autoriser.",
            "**Claude Pulse** (gratuit) : valider d'un coup les demandes sans risque, les commandes destructrices restant manuelles.",
            "**Notch** (open source) : autorisations venues d'autres machines via Tailscale.",
          ],
        },
        {
          h2: "Sur Windows",
          list: [
            "**Quiera** (gratuit, open source) : Dynamic Island complète (musique, lanceur, agenda…) avec un onglet Agents : autoriser/refuser avec le code de la modification, réponses aux questions, plans, retour au terminal, quota Claude et Codex, son, et réponses depuis le téléphone sur le Wi-Fi.",
            "**TwoCode** (9,99 € une fois) : autoriser ou refuser dans l'île, son et notification Windows, quota 5 h.",
            "**Status Island** (open source) : quotas, vitesse de consommation et contexte, en lecture seule.",
            "**IsleBar** (open source) : remplace la recherche de la barre des tâches et lance des agents ; les réponses se font dans le terminal.",
          ],
        },
        {
          h2: "Lequel choisir ?",
          p: [
            "Sur Mac, Vibe Island et Coucou sont les plus complets. Sur Windows, si tu veux répondre à Claude Code sans quitter ce que tu fais (autoriser, voir le code, répondre à une question), [Quiera](https://quiera.eu) est le seul à tout réunir gratuitement. Pour seulement surveiller tes quotas, Status Island fait très bien le travail.",
          ],
        },
      ],
    },
    en: {
      title: "The best notch and Dynamic Island apps for AI coding agents (Windows and Mac)",
      description: "A comparison of the apps that show Claude Code and Codex in a notch or a Dynamic Island: features, platforms, prices, and which to pick on Windows.",
      intro:
        "Since 2025, a wave of apps has put coding agents (Claude Code, Codex…) into the Mac's notch or a small island at the top of the screen: you see what they do, when they wait, and you answer them without switching windows. Here is what exists, from their makers' own pages (read in November 2026).",
      blocks: [
        {
          h2: "What a good app should do",
          list: [
            "**Live status**: working, waiting for you, done.",
            "**Allow or deny** a command without going back to the terminal, with the exact command or changed code in view.",
            "**Answer the agent's questions** and approve a plan.",
            "**Usage**: how much of the 5-hour and weekly limits is used.",
            "**Back to the terminal** in one click, and a **sound** when it's done.",
          ],
        },
        {
          h2: "On Mac",
          list: [
            "**Vibe Island** (paid): 30 agents, approvals with shortcuts, Markdown plans, jump to the exact terminal tab, sounds per event.",
            "**Coucou** (open source): many agents, “Always allow”, an iPhone app with Face ID to approve.",
            "**Claude Pulse** (free): approve safe requests in one go, destructive commands staying manual.",
            "**Notch** (open source): approvals from other machines over Tailscale.",
          ],
        },
        {
          h2: "On Windows",
          list: [
            "**Quiera** (free, open source): a full Dynamic Island (music, launcher, calendar…) with an Agents tab: allow/deny with the change's code, question answers, plans, back to the terminal, Claude and Codex usage, sound, and answers from your phone over Wi-Fi.",
            "**TwoCode** (€9.99 once): allow or deny in the island, sound and Windows notification, 5-hour usage.",
            "**Status Island** (open source): usage, burn rate and context, read-only.",
            "**IsleBar** (open source): replaces the taskbar search box and launches agents; answers happen in the terminal.",
          ],
        },
        {
          h2: "Which one to pick?",
          p: [
            "On Mac, Vibe Island and Coucou are the most complete. On Windows, if you want to answer Claude Code without leaving what you're doing (allow, see the code, answer a question), [Quiera](https://quiera.eu/en/) is the only one that does it all for free. To only watch your limits, Status Island does the job well.",
          ],
        },
      ],
    },
  },
  {
    slug: "claude-code-notifications",
    category: "agents",
    updated: "2026-11-08",
    related: ["approve-from-the-notch", "iphone-notifications", "codex-notifications"],
    fr: {
      slug: "notifications-claude-code",
      title: "Recevoir une notification quand Claude Code a fini ou attend ta réponse",
      description: "Comment être prévenu sous Windows quand Claude Code termine une tâche ou demande une autorisation : les hooks Notification, Stop et PermissionRequest, et la solution sans configuration.",
      intro:
        "Claude Code travaille souvent plusieurs minutes. Le piège : il s'arrête pour demander une autorisation, et tu ne le vois qu'en revenant au terminal. Voici comment être prévenu au bon moment.",
      blocks: [
        {
          h2: "Les événements que Claude Code expose",
          p: [
            "Claude Code lance des commandes à chaque étape de son travail : ce sont les **hooks**, déclarés dans `~/.claude/settings.json` ([documentation officielle](https://code.claude.com/docs/en/hooks-guide)). Trois comptent pour les notifications :",
          ],
          list: [
            "`Stop` : il a fini sa réponse.",
            "`Notification` : il attend (une autorisation, ou ta saisie après un moment d'inactivité). Ce signal arrive avec quelques secondes de retard.",
            "`PermissionRequest` : il va demander une autorisation, **immédiatement**.",
          ],
        },
        {
          h2: "Un bip sous Windows, à la main",
          p: ["Le plus simple : un son quand il a fini. Dans `~/.claude/settings.json` :"],
          code: `{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "powershell -c \\"[console]::beep(880,200)\\"" }] }]
  }
}`,
        },
        {
          h2: "Sans configuration, avec Quiera",
          p: [
            "[Quiera](https://quiera.eu) branche ces hooks pour toi (Réglages › Agents IA, ou en un clic quand l'île détecte Claude Code). Tu as alors une pilule qui montre ce que fait Claude, un aperçu et un son Windows quand il a fini ou t'attend, et chaque demande d'autorisation ou question directement sur l'île, avec ses boutons. Rien ne quitte ton PC.",
          ],
        },
      ],
    },
    en: {
      title: "Get notified when Claude Code is done or needs your answer",
      description: "How to get alerted on Windows when Claude Code finishes a task or asks for a permission: the Notification, Stop and PermissionRequest hooks, and the zero-setup way.",
      intro:
        "Claude Code often works for minutes. The trap: it stops to ask for a permission, and you only see it when you come back to the terminal. Here is how to be told at the right time.",
      blocks: [
        {
          h2: "The events Claude Code exposes",
          p: [
            "Claude Code runs commands at each step of its work: its **hooks**, declared in `~/.claude/settings.json` ([official docs](https://code.claude.com/docs/en/hooks-guide)). Three matter for notifications:",
          ],
          list: [
            "`Stop`: it finished its answer.",
            "`Notification`: it is waiting (a permission, or your input after a while). This signal comes a few seconds late.",
            "`PermissionRequest`: it is about to ask for a permission, **right away**.",
          ],
        },
        {
          h2: "A beep on Windows, by hand",
          p: ["The simplest: a sound when it's done. In `~/.claude/settings.json`:"],
          code: `{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "powershell -c \\"[console]::beep(880,200)\\"" }] }]
  }
}`,
        },
        {
          h2: "Zero setup, with Quiera",
          p: [
            "[Quiera](https://quiera.eu/en/) wires these hooks for you (Settings › AI agents, or in one click when the island detects Claude Code). You get a pill showing what Claude does, a peek and a Windows sound when it's done or needs you, and every permission request or question right on the island, with its buttons. Nothing leaves your PC.",
          ],
        },
      ],
    },
  },
  {
    slug: "codex-notifications",
    category: "agents",
    updated: "2026-11-08",
    related: ["claude-code-notifications", "check-codex-usage", "monitor-multiple-agents"],
    fr: {
      slug: "notifications-codex",
      title: "Notifications Codex : être prévenu quand Codex a fini ou attend",
      description: "Les deux façons d'être prévenu par OpenAI Codex sous Windows : l'option notify de config.toml et les hooks de Codex, et comment Quiera les affiche.",
      intro: "Codex CLI peut lui aussi prévenir quand il termine ou attend une autorisation. Deux mécanismes existent.",
      blocks: [
        {
          h2: "L'option notify",
          p: [
            "Dans `~/.codex/config.toml`, la clé `notify` lance un programme à la fin de chaque tour de Codex. C'est simple, mais elle ne signale que la fin, pas les demandes d'autorisation.",
          ],
        },
        {
          h2: "Les hooks de Codex",
          p: [
            "Les versions récentes de Codex ont des hooks au format proche de ceux de Claude Code, dans `~/.codex/hooks.json` : `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Stop`, `SessionEnd`. Deux particularités :",
          ],
          list: [
            "Sous Windows, Codex lance ces commandes **avec PowerShell**.",
            "Codex demande d'**approuver** les nouveaux hooks une fois : commande `/hooks` dans Codex, puis « Trust all ».",
          ],
        },
        {
          h2: "Avec Quiera",
          p: [
            "Dans [Quiera](https://quiera.eu), Réglages › Agents IA › Codex installe ces hooks pour toi. Ouvre ensuite Codex une fois et accepte-les : l'île montre alors ce que fait Codex, prévient quand il a fini, et te laisse autoriser ou refuser ses commandes. Le quota de ton offre Codex s'affiche aussi, lu dans ses fichiers de session.",
          ],
        },
      ],
    },
    en: {
      title: "Codex notifications: know when Codex is done or waiting",
      description: "The two ways OpenAI Codex can alert you on Windows: config.toml's notify option and Codex's hooks, and how Quiera shows them.",
      intro: "Codex CLI can also tell you when it finishes or waits for a permission. Two mechanisms exist.",
      blocks: [
        {
          h2: "The notify option",
          p: [
            "In `~/.codex/config.toml`, the `notify` key runs a program at the end of each Codex turn. It's simple, but it only signals the end, not permission requests.",
          ],
        },
        {
          h2: "Codex's hooks",
          p: [
            "Recent Codex versions have hooks close to Claude Code's, in `~/.codex/hooks.json`: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Stop`, `SessionEnd`. Two quirks:",
          ],
          list: ["On Windows, Codex runs them **through PowerShell**.", "Codex asks you to **trust** new hooks once: `/hooks` in Codex, then “Trust all”."],
        },
        {
          h2: "With Quiera",
          p: [
            "In [Quiera](https://quiera.eu/en/), Settings › AI agents › Codex installs these hooks for you. Then open Codex once and trust them: the island shows what Codex does, tells you when it's done, and lets you allow or deny its commands. Your Codex plan's usage shows too, read from its session files.",
          ],
        },
      ],
    },
  },
  {
    slug: "iphone-notifications",
    category: "agents",
    updated: "2026-11-08",
    related: ["claude-code-notifications", "approve-from-the-notch", "best-notch-apps"],
    fr: {
      slug: "repondre-claude-code-telephone",
      title: "Répondre à Claude Code depuis ton téléphone (iPhone ou Android)",
      description: "Autoriser ou refuser les demandes de Claude Code depuis un téléphone, sur le Wi-Fi, sans compte ni cloud : ce que fait Quiera, ses limites, et les autres solutions.",
      intro: "Tu lances une longue tâche, tu te lèves… et Claude Code attend ton accord depuis vingt minutes. Ton téléphone peut te sauver.",
      blocks: [
        {
          h2: "Avec Quiera, sur ton Wi-Fi",
          steps: [
            "Dans Quiera, Réglages › Agents IA › « Répondre depuis le téléphone » › Afficher le QR code.",
            "Scanne-le avec l'appareil photo du téléphone, connecté au même Wi-Fi que le PC.",
            "Garde la page ouverte : les demandes de Claude y apparaissent en direct, avec Autoriser et Refuser.",
          ],
          p: [
            "Rien ne passe par Internet ni par un compte. Par sécurité, les commandes risquées (suppression de dossiers, push forcé…), les questions et les plans se valident sur le PC. Le lien marche 8 heures.",
          ],
        },
        {
          h2: "Les limites, honnêtement",
          list: [
            "Il faut être sur le **même Wi-Fi** que le PC.",
            "La page doit rester **ouverte** : ce n'est pas une notification push. Sur Android, elle vibre à chaque demande ; sur iPhone, Safari ne le permet pas.",
          ],
        },
        {
          h2: "Pour de vraies notifications push",
          p: [
            "Il faut une app sur le téléphone : Coucou a une app iPhone (en bêta) qui autorise avec Face ID, et Status Island envoie des alertes de quota via l'app gratuite ntfy. Ces solutions passent par leurs propres services ou par le réseau.",
          ],
        },
      ],
    },
    en: {
      title: "Answer Claude Code from your phone (iPhone or Android)",
      description: "Allow or deny Claude Code's requests from a phone, over Wi-Fi, with no account or cloud: what Quiera does, its limits, and the other options.",
      intro: "You start a long task, you get up… and Claude Code has been waiting for your OK for twenty minutes. Your phone can save you.",
      blocks: [
        {
          h2: "With Quiera, over your Wi-Fi",
          steps: [
            "In Quiera, Settings › AI agents › “Answer from your phone” › Show the QR code.",
            "Scan it with the phone's camera, on the same Wi-Fi as the PC.",
            "Keep the page open: Claude's requests show up there live, with Allow and Deny.",
          ],
          p: [
            "Nothing goes through the Internet or an account. For safety, risky commands (deleting folders, forced pushes…), questions and plans are answered on the PC. The link works for 8 hours.",
          ],
        },
        {
          h2: "The limits, honestly",
          list: [
            "You must be on the **same Wi-Fi** as the PC.",
            "The page has to stay **open**: it's not a push notification. On Android it vibrates on each request; on iPhone, Safari doesn't allow it.",
          ],
        },
        {
          h2: "For real push notifications",
          p: [
            "You need an app on the phone: Coucou has an iPhone app (in beta) that approves with Face ID, and Status Island sends usage alerts through the free ntfy app. These go through their own services or the network.",
          ],
        },
      ],
    },
  },
  {
    slug: "check-claude-code-usage",
    category: "usage",
    updated: "2026-11-08",
    related: ["claude-code-rate-limits", "claude-code-cost", "ccusage-alternative"],
    fr: {
      slug: "voir-quota-claude-code",
      title: "Voir son quota Claude Code (limite de 5 h et hebdomadaire)",
      description: "Trois façons de savoir où tu en es de tes limites Claude Code : la commande /usage, la ligne d'état, et un cercle permanent sur l'écran avec Quiera.",
      intro: "Les abonnements Claude (Pro, Max…) limitent l'usage sur une fenêtre de 5 heures et sur la semaine. Le savoir avant d'être bloqué change tout.",
      blocks: [
        {
          h2: "Dans Claude Code : /usage",
          p: ["Tape `/usage` dans une session Claude Code : elle affiche la part utilisée de chaque limite et quand elle repart à zéro."],
        },
        {
          h2: "Dans la ligne d'état",
          p: [
            "Claude Code transmet à la commande de sa ligne d'état (`statusLine` dans `settings.json`) un champ `rate_limits` : `five_hour` et `seven_day`, chacun avec `used_percentage` et `resets_at`. Des scripts s'en servent pour afficher « 5h 42 % | 7j 17 % » sous le prompt.",
          ],
        },
        {
          h2: "En permanence, avec Quiera",
          p: [
            "[Quiera](https://quiera.eu) lit ces mêmes valeurs et les garde en mémoire entre deux démarrages : un cercle en haut de l'onglet Agents montre la limite la plus pleine, orange à 75 %, rouge à 90 %, avec l'heure de remise à zéro et une estimation (« plein dans ~40 min ») d'après ton rythme. Le cercle passe dans la pilule quand la limite approche.",
          ],
        },
      ],
    },
    en: {
      title: "Check your Claude Code usage (5-hour and weekly limits)",
      description: "Three ways to know where you stand on your Claude Code limits: the /usage command, the status line, and an always-on ring with Quiera.",
      intro: "Claude plans (Pro, Max…) limit usage over a 5-hour window and over the week. Knowing before you're blocked changes everything.",
      blocks: [
        {
          h2: "In Claude Code: /usage",
          p: ["Type `/usage` in a Claude Code session: it shows how much of each limit is used and when it resets."],
        },
        {
          h2: "In the status line",
          p: [
            "Claude Code passes its status line command (`statusLine` in `settings.json`) a `rate_limits` field: `five_hour` and `seven_day`, each with `used_percentage` and `resets_at`. Scripts use it to print “5h 42% | 7d 17%” under the prompt.",
          ],
        },
        {
          h2: "Always on, with Quiera",
          p: [
            "[Quiera](https://quiera.eu/en/) reads these same values and keeps them between restarts: a ring at the top of the Agents tab shows the fullest limit, orange at 75%, red at 90%, with the reset time and an estimate (“full in ~40 min”) from your pace. The ring moves into the pill when a limit gets close.",
          ],
        },
      ],
    },
  },
  {
    slug: "check-codex-usage",
    category: "usage",
    updated: "2026-11-08",
    related: ["codex-rate-limits", "codex-reset-status", "codexbar-alternative"],
    fr: {
      slug: "voir-quota-codex",
      title: "Voir son quota Codex",
      description: "Où trouver la part utilisée de tes limites OpenAI Codex : la commande /status, les fichiers de session, et le cercle de Quiera sous Windows.",
      intro: "Codex compte ton usage sur des fenêtres qui dépendent de ton offre ChatGPT. Voici comment voir où tu en es.",
      blocks: [
        {
          h2: "Dans Codex : /status",
          p: ["Dans une session Codex CLI, `/status` affiche le pourcentage restant de chaque fenêtre et l'heure de remise à zéro, telle que la donne le serveur d'OpenAI."],
        },
        {
          h2: "Dans les fichiers de Codex",
          p: [
            "Codex enregistre ses sessions dans `~/.codex/sessions`. Ses relevés contiennent un objet `rate_limits` : `primary` et `secondary`, chacun avec `used_percent`, `window_minutes` (300 pour 5 h, 10080 pour une semaine…) et `resets_at`. Sur l'offre gratuite, nous y avons vu une fenêtre de 30 jours.",
          ],
        },
        {
          h2: "Avec Quiera",
          p: [
            "[Quiera](https://quiera.eu) lit ce dernier relevé toutes les minutes (seulement les chiffres) et l'affiche en cercle dans l'onglet Agents, à côté de celui de Claude, avec la remise à zéro au survol.",
          ],
        },
      ],
    },
    en: {
      title: "Check your Codex usage",
      description: "Where to find how much of your OpenAI Codex limits is used: the /status command, the session files, and Quiera's ring on Windows.",
      intro: "Codex counts your usage over windows that depend on your ChatGPT plan. Here is how to see where you stand.",
      blocks: [
        {
          h2: "In Codex: /status",
          p: ["In a Codex CLI session, `/status` shows the remaining percentage of each window and the reset time, as OpenAI's server gives it."],
        },
        {
          h2: "In Codex's files",
          p: [
            "Codex records its sessions in `~/.codex/sessions`. Its readings hold a `rate_limits` object: `primary` and `secondary`, each with `used_percent`, `window_minutes` (300 for 5 hours, 10080 for a week…) and `resets_at`. On the free plan, we saw a 30-day window there.",
          ],
        },
        {
          h2: "With Quiera",
          p: [
            "[Quiera](https://quiera.eu/en/) reads that latest reading every minute (only the numbers) and shows it as a ring in the Agents tab, next to Claude's, with the reset time on hover.",
          ],
        },
      ],
    },
  },
  {
    slug: "codex-vs-claude-code",
    category: "usage",
    updated: "2026-11-08",
    related: ["claude-code-cost", "codex-cost", "monitor-multiple-agents"],
    fr: {
      slug: "codex-ou-claude-code",
      title: "Codex ou Claude Code : lequel choisir ?",
      description: "Comparatif pratique d'OpenAI Codex et de Claude Code : abonnements, limites, autorisations, intégrations, et comment utiliser les deux sur un même PC Windows.",
      intro: "Codex (OpenAI) et Claude Code (Anthropic) sont deux agents de code en ligne de commande. Ils se ressemblent beaucoup ; voici ce qui les distingue en pratique.",
      blocks: [
        {
          h2: "Abonnement et limites",
          list: [
            "**Claude Code** est inclus dans les abonnements Claude à partir de Pro. L'usage est limité sur une fenêtre de 5 h et sur la semaine, en commun avec le chat Claude.",
            "**Codex** est inclus dans les offres ChatGPT (Plus, Pro, Business…, un peu sur l'offre gratuite). Les fenêtres dépendent de l'offre.",
            "Les deux peuvent aussi fonctionner avec une clé d'API, facturée au jeton.",
          ],
        },
        {
          h2: "Autorisations et contrôle",
          p: [
            "Claude Code demande l'accord pour les commandes et les modifications, avec un mode plan et des questions à choix (AskUserQuestion). Codex combine une politique d'approbation et un bac à sable (lecture seule, écriture dans le dossier…). Les deux ont des hooks pour brancher des outils externes.",
          ],
        },
        {
          h2: "Les utiliser ensemble",
          p: [
            "Beaucoup de développeurs gardent les deux, et basculent quand une limite est atteinte. [Quiera](https://quiera.eu) suit les deux dans le même onglet : sessions, demandes à autoriser, et le quota de chacun côte à côte.",
          ],
        },
      ],
    },
    en: {
      title: "Codex or Claude Code: which one?",
      description: "A practical comparison of OpenAI Codex and Claude Code: plans, limits, approvals, integrations, and how to use both on one Windows PC.",
      intro: "Codex (OpenAI) and Claude Code (Anthropic) are two command-line coding agents. They look a lot alike; here is what tells them apart in practice.",
      blocks: [
        {
          h2: "Plans and limits",
          list: [
            "**Claude Code** comes with Claude plans from Pro up. Usage is limited over a 5-hour window and over the week, shared with Claude chat.",
            "**Codex** comes with ChatGPT plans (Plus, Pro, Business…, a little on Free). Its windows depend on the plan.",
            "Both can also run with an API key, billed per token.",
          ],
        },
        {
          h2: "Approvals and control",
          p: [
            "Claude Code asks before commands and edits, with a plan mode and multiple-choice questions (AskUserQuestion). Codex combines an approval policy with a sandbox (read-only, write in the folder…). Both have hooks to plug in outside tools.",
          ],
        },
        {
          h2: "Using both",
          p: [
            "Many developers keep both, and switch when a limit is reached. [Quiera](https://quiera.eu/en/) follows both in the same tab: sessions, requests to allow, and each one's usage side by side.",
          ],
        },
      ],
    },
  },
  {
    slug: "claude-code-cost",
    category: "usage",
    updated: "2026-11-08",
    related: ["claude-code-rate-limits", "check-claude-code-usage", "codex-cost"],
    fr: {
      slug: "prix-claude-code",
      title: "Combien coûte Claude Code ?",
      description: "Les prix de Claude Code en novembre 2026 : abonnements Pro, Max et Ultra, ou paiement à l'usage avec une clé d'API, et comment suivre sa consommation.",
      intro: "Claude Code ne se vend pas seul : il est inclus dans les abonnements Claude, ou facturé au jeton avec une clé d'API.",
      blocks: [
        {
          h2: "Les abonnements (relevé fin octobre 2026)",
          list: [
            "**Pro** : 20 $ par mois, Claude Code inclus.",
            "**Max** : 100 $ par mois, environ 5 fois l'usage de Pro.",
            "**Ultra** : 200 $ par mois, pour les très gros usages.",
          ],
          p: [
            "Ces prix évoluent : vérifie-les sur [la page officielle](https://www.anthropic.com/pricing) et dans [l'aide de Claude](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan).",
          ],
        },
        {
          h2: "Avec une clé d'API",
          p: [
            "Claude Code peut aussi utiliser une clé de l'API Anthropic : il n'y a alors plus de limite d'abonnement, mais chaque jeton est facturé. Pour un usage intensif ou plusieurs agents en parallèle, l'abonnement revient en général moins cher.",
          ],
        },
        {
          h2: "Garder un œil dessus",
          p: [
            "Sur abonnement, ce qui compte est la part utilisée des limites. [Quiera](https://quiera.eu) l'affiche en permanence sous Windows, avec une estimation du moment où tu seras bloqué à ton rythme.",
          ],
        },
      ],
    },
    en: {
      title: "How much does Claude Code cost?",
      description: "Claude Code pricing in November 2026: Pro, Max and Ultra plans, or pay-as-you-go with an API key, and how to keep an eye on your usage.",
      intro: "Claude Code isn't sold on its own: it comes with Claude plans, or is billed per token with an API key.",
      blocks: [
        {
          h2: "The plans (read late October 2026)",
          list: ["**Pro**: $20 a month, Claude Code included.", "**Max**: $100 a month, about 5 times Pro's usage.", "**Ultra**: $200 a month, for very heavy use."],
          p: [
            "These prices change: check them on [the official page](https://www.anthropic.com/pricing) and in [Claude's help](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan).",
          ],
        },
        {
          h2: "With an API key",
          p: [
            "Claude Code can also use an Anthropic API key: there's no plan limit then, but every token is billed. For heavy use or several agents in parallel, a plan usually costs less.",
          ],
        },
        {
          h2: "Keeping an eye on it",
          p: [
            "On a plan, what matters is how much of the limits is used. [Quiera](https://quiera.eu/en/) shows it at all times on Windows, with an estimate of when you'll be blocked at your pace.",
          ],
        },
      ],
    },
  },
  {
    slug: "codex-cost",
    category: "usage",
    updated: "2026-11-08",
    related: ["codex-rate-limits", "check-codex-usage", "claude-code-cost"],
    fr: {
      slug: "prix-codex",
      title: "Combien coûte Codex ?",
      description: "Les prix d'OpenAI Codex en novembre 2026 : offres ChatGPT Free, Go, Plus, Pro et Business, crédits, ou clé d'API, et comment suivre son usage.",
      intro: "Codex est inclus dans les offres ChatGPT ; on peut aussi le payer à l'usage avec une clé d'API.",
      blocks: [
        {
          h2: "Les offres (relevé fin octobre 2026)",
          list: [
            "**Free** : un peu de Codex, avec une fenêtre d'usage longue.",
            "**Go** : 8 $ par mois. **Plus** : 20 $ par mois.",
            "**Pro** : 100 $, 200 $ ou 500 $ par mois selon le volume.",
            "**Business** : environ 20 à 25 $ par utilisateur et par mois.",
          ],
          p: ["Vérifie les montants actuels sur [la page des offres ChatGPT](https://chatgpt.com/pricing) : ils changent souvent."],
        },
        {
          h2: "Crédits et clé d'API",
          p: [
            "Quand une limite est atteinte, des crédits ChatGPT peuvent prolonger l'usage sur les offres payantes. Avec une clé d'API, Codex est facturé au jeton, sans les limites de l'offre.",
          ],
        },
        {
          h2: "Suivre son usage",
          p: ["[Quiera](https://quiera.eu) affiche la part utilisée de ta fenêtre Codex en cercle, sous Windows, lue dans les fichiers de Codex."],
        },
      ],
    },
    en: {
      title: "How much does Codex cost?",
      description: "OpenAI Codex pricing in November 2026: ChatGPT Free, Go, Plus, Pro and Business plans, credits, or an API key, and how to track your usage.",
      intro: "Codex comes with ChatGPT plans; you can also pay as you go with an API key.",
      blocks: [
        {
          h2: "The plans (read late October 2026)",
          list: [
            "**Free**: a little Codex, with a long usage window.",
            "**Go**: $8 a month. **Plus**: $20 a month.",
            "**Pro**: $100, $200 or $500 a month depending on volume.",
            "**Business**: about $20 to $25 per user per month.",
          ],
          p: ["Check today's amounts on [ChatGPT's pricing page](https://chatgpt.com/pricing): they change often."],
        },
        {
          h2: "Credits and API key",
          p: ["When a limit is reached, ChatGPT credits can extend usage on paid plans. With an API key, Codex is billed per token, without the plan's limits."],
        },
        {
          h2: "Tracking your usage",
          p: ["[Quiera](https://quiera.eu/en/) shows how much of your Codex window is used as a ring, on Windows, read from Codex's own files."],
        },
      ],
    },
  },
  {
    slug: "claude-code-rate-limits",
    category: "usage",
    updated: "2026-11-08",
    related: ["check-claude-code-usage", "claude-code-cost", "monitor-multiple-agents"],
    fr: {
      slug: "limites-claude-code",
      title: "Les limites de Claude Code expliquées (5 heures et semaine)",
      description: "Comment fonctionnent les limites d'usage de Claude Code : fenêtre glissante de 5 heures, plafond hebdomadaire, plusieurs agents, et comment éviter d'être bloqué.",
      intro: "« Limite atteinte, revenez dans 2 heures. » Voici comment marchent les limites de Claude Code sur abonnement.",
      blocks: [
        {
          h2: "Deux limites",
          list: [
            "**La fenêtre de 5 heures** : elle démarre à ton premier message et se remet à zéro 5 heures plus tard.",
            "**Le plafond hebdomadaire** : un total sur 7 jours, qui se remet à zéro à heure fixe.",
          ],
          p: ["Selon l'offre, l'une ou l'autre peut changer ou disparaître : la [page d'aide de Claude](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) fait foi."],
        },
        {
          h2: "Pourquoi on les atteint si vite",
          p: [
            "Le chat Claude et Claude Code puisent dans le même quota. Et plusieurs agents en parallèle le consomment d'autant plus vite : cinq sessions actives peuvent vider une fenêtre de 5 heures en moins d'une heure.",
          ],
        },
        {
          h2: "Voir venir le blocage",
          p: [
            "[Quiera](https://quiera.eu) calcule ton rythme à partir des relevés successifs et prévient « plein dans ~40 min » avant la remise à zéro. Le cercle passe à l'orange à 75 %, au rouge à 90 %.",
          ],
        },
      ],
    },
    en: {
      title: "Claude Code's limits explained (5 hours and weekly)",
      description: "How Claude Code's usage limits work: the rolling 5-hour window, the weekly cap, several agents at once, and how not to get blocked.",
      intro: "“Limit reached, come back in 2 hours.” Here is how Claude Code's plan limits work.",
      blocks: [
        {
          h2: "Two limits",
          list: [
            "**The 5-hour window**: it starts with your first message and resets 5 hours later.",
            "**The weekly cap**: a total over 7 days, reset at a fixed time.",
          ],
          p: ["Depending on the plan, either can change or go away: [Claude's help page](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) is the reference."],
        },
        {
          h2: "Why you reach them so fast",
          p: [
            "Claude chat and Claude Code draw from the same quota. And several agents in parallel burn it that much faster: five active sessions can empty a 5-hour window in under an hour.",
          ],
        },
        {
          h2: "See the block coming",
          p: [
            "[Quiera](https://quiera.eu/en/) works out your pace from successive readings and warns “full in ~40 min” before the reset. The ring turns orange at 75%, red at 90%.",
          ],
        },
      ],
    },
  },
  {
    slug: "codex-rate-limits",
    category: "usage",
    updated: "2026-11-08",
    related: ["codex-reset-status", "check-codex-usage", "codex-cost"],
    fr: {
      slug: "limites-codex",
      title: "Les limites de Codex expliquées",
      description: "Comment fonctionnent les limites d'usage d'OpenAI Codex selon l'offre ChatGPT, les crédits, et comment les suivre sous Windows.",
      intro: "Codex limite l'usage par fenêtres de temps, dont la durée et la taille dépendent de ton offre ChatGPT.",
      blocks: [
        {
          h2: "Des fenêtres qui dépendent de l'offre",
          p: [
            "Codex compte ton usage sur une ou deux fenêtres (`primary`, `secondary`) : selon l'offre et la période, 5 heures, une semaine, ou 30 jours sur l'offre gratuite. OpenAI a déjà modifié ces fenêtres plusieurs fois en 2026 : regarde `/status` dans Codex pour les tiennes.",
          ],
        },
        {
          h2: "Au-delà de la limite",
          p: ["Sur les offres payantes, des crédits ChatGPT prolongent l'usage. Avec une clé d'API, il n'y a plus de limite d'offre, mais chaque jeton est facturé."],
        },
        {
          h2: "Les suivre en continu",
          p: ["[Quiera](https://quiera.eu) lit les fenêtres de Codex dans ses fichiers de session et les affiche en cercle, avec l'heure de remise à zéro et le rythme de consommation."],
        },
      ],
    },
    en: {
      title: "Codex's limits explained",
      description: "How OpenAI Codex's usage limits work depending on the ChatGPT plan, credits, and how to follow them on Windows.",
      intro: "Codex limits usage over time windows whose length and size depend on your ChatGPT plan.",
      blocks: [
        {
          h2: "Windows that depend on the plan",
          p: [
            "Codex counts your usage over one or two windows (`primary`, `secondary`): depending on the plan and the period, 5 hours, a week, or 30 days on the free plan. OpenAI changed these windows several times in 2026: check `/status` in Codex for yours.",
          ],
        },
        {
          h2: "Past the limit",
          p: ["On paid plans, ChatGPT credits extend usage. With an API key, there's no plan limit, but every token is billed."],
        },
        {
          h2: "Following them all the time",
          p: ["[Quiera](https://quiera.eu/en/) reads Codex's windows from its session files and shows them as a ring, with the reset time and your pace."],
        },
      ],
    },
  },
  {
    slug: "codex-reset-status",
    category: "usage",
    updated: "2026-11-08",
    related: ["codex-rate-limits", "check-codex-usage", "claude-code-rate-limits"],
    fr: {
      slug: "reinitialisation-quota-codex",
      title: "Quand mon quota Codex se remet-il à zéro ?",
      description: "Savoir quand ta limite OpenAI Codex repart à zéro : /status, le champ resets_at, et l'affichage permanent de Quiera.",
      intro: "Bloqué par Codex ? L'heure exacte de remise à zéro est connue : il suffit de savoir où la lire.",
      blocks: [
        {
          h2: "Avec /status",
          p: ["Dans Codex CLI, `/status` affiche chaque fenêtre, le pourcentage restant et son heure de remise à zéro. Cette heure vient du serveur d'OpenAI : Codex ne la calcule pas lui-même."],
        },
        {
          h2: "Dans les fichiers",
          p: ["Chaque relevé de `~/.codex/sessions` contient `resets_at` (en secondes depuis 1970) pour chaque fenêtre."],
        },
        {
          h2: "D'un coup d'œil",
          p: ["Dans [Quiera](https://quiera.eu), survole le cercle de Codex : « repart à zéro dans 3 h ». Une fois la fenêtre passée, le cercle se vide tout seul."],
        },
      ],
    },
    en: {
      title: "When does my Codex usage reset?",
      description: "Know when your OpenAI Codex limit resets: /status, the resets_at field, and Quiera's always-on display.",
      intro: "Blocked by Codex? The exact reset time is known: you only need to know where to read it.",
      blocks: [
        {
          h2: "With /status",
          p: ["In Codex CLI, `/status` shows each window, the remaining percentage and its reset time. That time comes from OpenAI's server: Codex doesn't compute it itself."],
        },
        {
          h2: "In the files",
          p: ["Each reading in `~/.codex/sessions` holds `resets_at` (seconds since 1970) for each window."],
        },
        {
          h2: "At a glance",
          p: ["In [Quiera](https://quiera.eu/en/), hover Codex's ring: “resets in 3h”. Once the window has passed, the ring empties by itself."],
        },
      ],
    },
  },
  {
    slug: "monitor-multiple-agents",
    category: "agents",
    updated: "2026-11-08",
    related: ["approve-from-the-notch", "claude-code-rate-limits", "best-notch-apps"],
    fr: {
      slug: "suivre-plusieurs-agents-ia",
      title: "Surveiller plusieurs agents IA en parallèle sans s'y perdre",
      description: "Faire tourner plusieurs sessions Claude Code ou Codex en même temps : les vrais problèmes (attention, quota, conflits) et une méthode pour les suivre sous Windows.",
      intro: "Lancer trois agents en parallèle semble multiplier la productivité. En pratique, c'est l'attention qui devient le goulot.",
      blocks: [
        {
          h2: "Les vrais problèmes",
          list: [
            "**L'attention** : au-delà de deux sessions, aller voir qui attend quoi coûte plus que ça ne rapporte.",
            "**Le quota** : chaque agent consomme la même limite ; plusieurs la vident d'autant plus vite.",
            "**Les conflits** : deux agents dans le même dossier se marchent dessus ; les worktrees Git les séparent.",
          ],
        },
        {
          h2: "Une méthode simple",
          steps: [
            "Un dossier (ou un worktree) par agent, une tâche bien délimitée chacun.",
            "Être prévenu, plutôt que vérifier : un signal quand un agent attend ou a fini.",
            "Répondre sans quitter ce que tu fais, et revenir au bon terminal d'un clic quand il le faut.",
          ],
        },
        {
          h2: "Avec Quiera",
          p: [
            "L'onglet Agents de [Quiera](https://quiera.eu) liste toutes les sessions, Claude Code et Codex, dans l'ordre où elles ont démarré ; celle qui t'attend passe en orange avec un son. Au survol, ses derniers fichiers et pages s'ouvrent d'un clic ; un clic sur la session ramène son terminal ou VS Code.",
          ],
        },
      ],
    },
    en: {
      title: "Monitor several AI agents in parallel without getting lost",
      description: "Running several Claude Code or Codex sessions at once: the real problems (attention, usage, conflicts) and a way to follow them on Windows.",
      intro: "Running three agents in parallel seems to triple your output. In practice, attention becomes the bottleneck.",
      blocks: [
        {
          h2: "The real problems",
          list: [
            "**Attention**: past two sessions, checking who waits for what costs more than it saves.",
            "**Usage**: every agent draws on the same limit; several empty it that much faster.",
            "**Conflicts**: two agents in one folder step on each other; Git worktrees keep them apart.",
          ],
        },
        {
          h2: "A simple method",
          steps: [
            "One folder (or worktree) per agent, one well-bounded task each.",
            "Be told rather than check: a signal when an agent waits or is done.",
            "Answer without leaving what you're doing, and jump to the right terminal in one click when needed.",
          ],
        },
        {
          h2: "With Quiera",
          p: [
            "[Quiera](https://quiera.eu/en/)'s Agents tab lists every session, Claude Code and Codex, in the order they started; the one waiting for you turns orange with a sound. On hover, its latest files and pages open in one click; clicking the session brings back its terminal or VS Code.",
          ],
        },
      ],
    },
  },
  {
    slug: "approve-from-the-notch",
    category: "agents",
    updated: "2026-11-08",
    related: ["claude-code-notifications", "iphone-notifications", "best-notch-apps"],
    fr: {
      slug: "autoriser-claude-code-sans-terminal",
      title: "Autoriser Claude Code depuis l'île, sans revenir au terminal",
      description: "Comment fonctionnent les autorisations de Claude Code à distance (hook PermissionRequest), et comment Quiera les affiche sous Windows avec le code de la modification.",
      intro: "Sur Mac, des apps permettent d'autoriser Claude Code depuis l'encoche. Sous Windows, Quiera le fait depuis sa Dynamic Island.",
      blocks: [
        {
          h2: "Le mécanisme",
          p: [
            "Avant de te poser une question d'autorisation, Claude Code lance le hook `PermissionRequest`. Si ce hook répond « allow » ou « deny », la question n'apparaît pas dans le terminal. C'est ce qui permet de répondre depuis une autre app.",
          ],
        },
        {
          h2: "Ce que montre Quiera",
          list: [
            "La **commande exacte**, ou le **code modifié** (lignes retirées en rouge, ajoutées en vert), ou le **plan** à valider.",
            "**Refuser**, **Terminal**, **Toujours** (quand Claude le propose) et **Autoriser**.",
            "Les **commandes risquées** (rm -rf, push forcé…) en rouge, à autoriser en maintenant le bouton.",
            "Les **questions** de Claude, avec leurs options, ou une réponse tapée.",
          ],
        },
        {
          h2: "Et si tu préfères le terminal ?",
          p: [
            "Le bouton Terminal renvoie la question dans le terminal ou VS Code, si tu préfères y répondre ; si personne ne répond pendant 30 minutes, elle y retourne aussi. [Télécharger Quiera](" + DOWNLOAD + ") · [documentation](" + DOCS + ").",
          ],
        },
      ],
    },
    en: {
      title: "Approve Claude Code from the island, without going back to the terminal",
      description: "How remote approvals work in Claude Code (the PermissionRequest hook), and how Quiera shows them on Windows with the change's code.",
      intro: "On Mac, apps let you approve Claude Code from the notch. On Windows, Quiera does it from its Dynamic Island.",
      blocks: [
        {
          h2: "The mechanism",
          p: [
            "Before asking you for a permission, Claude Code runs the `PermissionRequest` hook. If that hook answers “allow” or “deny”, the question never shows in the terminal. That's what lets another app answer.",
          ],
        },
        {
          h2: "What Quiera shows",
          list: [
            "The **exact command**, or the **changed code** (removed lines in red, added in green), or the **plan** to approve.",
            "**Deny**, **Terminal**, **Always** (when Claude offers it) and **Allow**.",
            "**Risky commands** (rm -rf, forced pushes…) in red, allowed by holding the button.",
            "Claude's **questions**, with their options, or a typed answer.",
          ],
        },
        {
          h2: "And if you'd rather use the terminal?",
          p: [
            "The Terminal button sends the question back to the terminal or VS Code, if you'd rather answer there; if nobody answers for 30 minutes, it goes back there too. [Download Quiera](" + DOWNLOAD + ") · [docs](" + DOCS + ").",
          ],
        },
      ],
    },
  },
  {
    slug: "ccusage-alternative",
    category: "usage",
    updated: "2026-11-08",
    related: ["check-claude-code-usage", "codexbar-alternative", "claude-code-rate-limits"],
    fr: {
      slug: "alternative-ccusage",
      title: "Une alternative à ccusage sous Windows",
      description: "ccusage calcule la consommation de Claude Code à partir de ses fichiers locaux. Pour voir en direct ses limites d'abonnement sous Windows, voici l'alternative.",
      intro: "ccusage est un outil en ligne de commande apprécié pour analyser l'usage de Claude Code. Il ne répond pas à la même question que Quiera.",
      blocks: [
        {
          h2: "Ce que fait ccusage",
          p: ["ccusage lit les journaux locaux de Claude Code et en tire des rapports : jetons consommés et coût estimé, par jour ou par session. Idéal pour savoir ce qu'aurait coûté ton usage à l'API."],
        },
        {
          h2: "Ce qu'il ne montre pas",
          p: ["Sur abonnement, ce qui te bloque, c'est la part utilisée de la limite de 5 h et de la semaine. Celle-ci vient du serveur d'Anthropic, et ccusage ne l'affiche pas en direct."],
        },
        {
          h2: "Quiera, pour les limites en direct",
          p: [
            "[Quiera](https://quiera.eu) affiche les vraies limites de ton abonnement (transmises par Claude Code), en permanence, avec le rythme et l'heure de remise à zéro, et celles de Codex à côté. Les deux outils se complètent : ccusage pour les rapports, Quiera pour le direct.",
          ],
        },
      ],
    },
    en: {
      title: "A ccusage alternative on Windows",
      description: "ccusage works out Claude Code's consumption from its local files. To see your plan's limits live on Windows, here's the alternative.",
      intro: "ccusage is a well-liked command-line tool to analyse Claude Code usage. It doesn't answer the same question as Quiera.",
      blocks: [
        {
          h2: "What ccusage does",
          p: ["ccusage reads Claude Code's local logs and builds reports: tokens used and estimated cost, per day or per session. Great to know what your usage would have cost on the API."],
        },
        {
          h2: "What it doesn't show",
          p: ["On a plan, what blocks you is how much of the 5-hour and weekly limits is used. That comes from Anthropic's server, and ccusage doesn't show it live."],
        },
        {
          h2: "Quiera, for live limits",
          p: [
            "[Quiera](https://quiera.eu/en/) shows your plan's real limits (passed on by Claude Code), at all times, with the pace and the reset time, and Codex's next to them. The two complement each other: ccusage for reports, Quiera for live.",
          ],
        },
      ],
    },
  },
  {
    slug: "codexbar-alternative",
    category: "usage",
    updated: "2026-11-08",
    related: ["check-codex-usage", "ccusage-alternative", "best-notch-apps"],
    fr: {
      slug: "alternative-codexbar",
      title: "Une alternative à CodexBar pour Windows",
      description: "CodexBar affiche les limites de Codex, Claude et d'autres IA dans la barre de menus du Mac. Sous Windows, Quiera les met dans une Dynamic Island.",
      intro: "CodexBar est une app de barre de menus pour macOS qui affiche les limites de plusieurs IA. Elle n'existe pas sous Windows.",
      blocks: [
        {
          h2: "Ce que fait CodexBar",
          p: ["Sur Mac, CodexBar montre les fenêtres d'usage (session, semaine) de Codex, Claude et d'autres fournisseurs, avec leur remise à zéro, et un outil en ligne de commande pour les coûts."],
        },
        {
          h2: "L'équivalent sous Windows",
          p: [
            "[Quiera](https://quiera.eu) affiche les limites de Claude et de Codex en cercles, dans l'onglet Agents de sa Dynamic Island en haut de l'écran : pourcentage, remise à zéro, rythme, alerte à 75 % et 90 %. En plus, il suit les sessions de ces agents et te laisse répondre à leurs demandes.",
          ],
        },
        {
          h2: "Ce qui manque encore",
          p: ["Quiera suit Claude Code et Codex ; les autres fournisseurs couverts par CodexBar (Cursor, Gemini…) ne le sont pas encore."],
        },
      ],
    },
    en: {
      title: "A CodexBar alternative for Windows",
      description: "CodexBar shows the limits of Codex, Claude and other AIs in the Mac's menu bar. On Windows, Quiera puts them in a Dynamic Island.",
      intro: "CodexBar is a macOS menu bar app that shows several AIs' limits. It doesn't exist on Windows.",
      blocks: [
        {
          h2: "What CodexBar does",
          p: ["On Mac, CodexBar shows the usage windows (session, week) of Codex, Claude and other providers, with their reset, plus a command-line tool for costs."],
        },
        {
          h2: "The Windows equivalent",
          p: [
            "[Quiera](https://quiera.eu/en/) shows Claude's and Codex's limits as rings, in the Agents tab of its Dynamic Island at the top of the screen: percentage, reset, pace, warning at 75% and 90%. On top of that, it follows those agents' sessions and lets you answer their requests.",
          ],
        },
        {
          h2: "What's still missing",
          p: ["Quiera follows Claude Code and Codex; the other providers CodexBar covers (Cursor, Gemini…) aren't there yet."],
        },
      ],
    },
  },
];

export const GUIDES: Guide[] = [...MORE_GUIDES, ...AGENT_GUIDES];

/** The families, in the index's order, with their icon (an inline SVG path). */
export const GUIDE_CATEGORIES: { id: GuideCategory; icon: string; fr: { name: string; text: string }; en: { name: string; text: string } }[] = [
  {
    id: "island",
    icon: "M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM4 16h16M4 20h10",
    fr: { name: "Dynamic Island", text: "L'île en haut de l'écran : l'installer, la régler, la cacher." },
    en: { name: "Dynamic Island", text: "The island at the top of the screen: install, set up, hide it." },
  },
  {
    id: "music",
    icon: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    fr: { name: "Musique et paroles", text: "Spotify, YouTube, paroles synchronisées." },
    en: { name: "Music and lyrics", text: "Spotify, YouTube, synced lyrics." },
  },
  {
    id: "productivity",
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3",
    fr: { name: "Lanceur et productivité", text: "Recherche, calculs, minuteurs, presse-papiers." },
    en: { name: "Launcher and productivity", text: "Search, calculations, timers, clipboard." },
  },
  {
    id: "files",
    icon: "M12 3v12M7 10l5 5 5-5M5 21h14",
    fr: { name: "Fichiers et téléphone", text: "Envoyer au téléphone, garder des fichiers sous la main." },
    en: { name: "Files and phone", text: "Send to your phone, keep files at hand." },
  },
  {
    id: "calendar",
    icon: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 2v4M15 2v4",
    fr: { name: "Agenda et visios", text: "Réunions, liens iCal, Teams, Meet, Zoom, webcam." },
    en: { name: "Calendar and calls", text: "Meetings, iCal links, Teams, Meet, Zoom, webcam." },
  },
  {
    id: "devices",
    icon: "M3 14v-2a9 9 0 0 1 18 0v2M3 14h3v6H4a1 1 0 0 1-1-1zM21 14h-3v6h2a1 1 0 0 0 1-1z",
    fr: { name: "Son, appareils et notifications", text: "Sortie audio, volumes, batteries, Wi-Fi, alertes." },
    en: { name: "Sound, devices and notifications", text: "Audio output, volumes, batteries, Wi-Fi, alerts." },
  },
  {
    id: "agents",
    icon: "M4 17l6-5-6-5M12 19h8",
    fr: { name: "Agents IA", text: "Claude Code et Codex : notifications, autorisations." },
    en: { name: "AI agents", text: "Claude Code and Codex: notifications, approvals." },
  },
  {
    id: "usage",
    icon: "M12 3a9 9 0 1 0 9 9M12 3v9h9M12 3a9 9 0 0 1 9 9",
    fr: { name: "Quotas et prix des IA", text: "Limites, coûts, réinitialisations de Claude et Codex." },
    en: { name: "AI limits and prices", text: "Limits, costs, resets for Claude and Codex." },
  },
];

/** Shown first on the index: the most searched. */
export const FEATURED_GUIDES = ["best-dynamic-island-windows", "spotify-lyrics-pc", "send-file-pc-to-iphone", "claude-code-notifications"];

/** The guides' index page. */
export const GUIDES_INDEX = {
  fr: {
    title: "Guides Windows : Dynamic Island, musique, fichiers, agents IA",
    description: "Guides pratiques pour Windows : Dynamic Island, paroles Spotify, envoi de fichiers au téléphone, lanceur, agenda, son, batteries, et agents IA comme Claude Code et Codex.",
    intro: "Des réponses courtes et vérifiées aux questions qu'on se pose sur son PC : la musique, les fichiers, les réunions, le son, et les agents IA.",
  },
  en: {
    title: "Windows guides: Dynamic Island, music, files, AI agents",
    description: "Practical guides for Windows: Dynamic Island, Spotify lyrics, sending files to your phone, launcher, calendar, sound, batteries, and AI agents like Claude Code and Codex.",
    intro: "Short, checked answers to the questions you ask about your PC: music, files, meetings, sound, and AI agents.",
  },
};
