# Étape 3 : robustesse système, vérifications

## Automatique

`cargo test` (dans `src-tauri`) couvre la règle de plein écran (7 cas), la limite de reprises après plantage et la lecture de l'argument de relance.

## Vérifié le 28/10/2026 (version optimisée, Windows 11, 1920 × 1080)

| Situation | Résultat |
|---|---|
| Un jeu en plein écran (fenêtre sans bordure 1920 × 1080) au premier plan | Détecté, l'île se masque (`Fullscreen(true)` dans le journal) |
| Sortie du jeu, autre fenêtre au premier plan | Détecté, l'île revient (`Fullscreen(false)`) |
| Processus d'affichage de WebView2 tué | Page rechargée, nouveau processus, Quiera continue |
| Processus principal de WebView2 tué | Quiera se relance tout seul (`--relaunch-after`) ; l'instance unique ne bloque pas la relance |
| Nouveau plantage 19 s après une relance | Quiera se ferme proprement au lieu de boucler |
| CPU au repos sur 30 s, surveillance système active | Quiera (Rust) 0 ms ; avec WebView2 0,026 % |
| Mémoire privée totale | 176 Mo (147 Mo à l'étape 1) |

Ce qui n'a **pas** marché et a été changé : reconstruire la fenêtre après la mort du moteur web. WebView2 ne peut pas créer de nouvelle vue dans le même processus (erreur `0x8007139F`), d'où la relance du processus entier.

Point resté ouvert : en mode développement, un rechargement après plantage a une fois affiché une erreur de module Vite (`DURATIONS` introuvable alors qu'il existe). Pas reproduit avec la version optimisée, qui n'utilise pas Vite.

## Manuel (version optimisée en cours d'exécution)

Le journal est dans `%LOCALAPPDATA%\app.quiera\logs\Quiera.log` : chaque événement y est écrit (`system: …`).

- [ ] **Plein écran** : une vidéo YouTube en plein écran, puis F11 dans un navigateur : l'île disparaît, puis revient en sortant.
- [ ] **Fenêtre agrandie** (pas en plein écran) : l'île reste visible.
- [ ] **Alt+Tab** pendant un jeu en plein écran : l'île ne clignote pas.
- [ ] **Verrouillage** (Win+L) puis retour : l'île est à sa place et au-dessus des fenêtres.
- [ ] **Mise en veille** puis réveil : idem.
- [ ] **Redémarrer l'Explorateur** (Gestionnaire des tâches > Explorateur Windows > Redémarrer) : l'icône Quiera revient dans la zone de notification, l'île reste au-dessus.
- [ ] **Changer de résolution** ou brancher/débrancher un écran : l'île se replace en haut au centre de l'écran principal.
- [ ] **Une fenêtre « toujours au-dessus »** (Gestionnaire des tâches avec cette option) : en cliquant ailleurs, l'île repasse au-dessus.
