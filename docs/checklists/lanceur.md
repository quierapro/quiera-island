# Lanceur, vérifications

Un raccourci ouvre une barre de recherche dans l'île, qui prend le clavier ; Échap (ou cliquer ailleurs) la ferme et rend le clavier à la fenêtre d'avant.

- **Raccourci** : Alt+Espace, ou Ctrl+Alt+Espace quand une autre appli tient Alt+Espace (ici Listary ou un autre programme). Le journal dit lequel (`launcher shortcut`).
- **Applis** : toutes celles du dossier Applications du shell (Store et classiques, comme le menu Démarrer), sans les désinstalleurs. Recherche par début de nom, mot, initiales (`vsc`), lettres dans l'ordre (`sptfy`), sans accents ni casse ; les plus ouvertes remontent (compté sur l'appareil).
- **Fichiers** : index de tous les disques internes (509 000 entrées ici, 35 Mo, ~30 s en arrière-plan, refait à l'ouverture s'il a plus de 10 min). Entrée ouvre, Ctrl+Entrée montre dans l'Explorateur. Date de chaque fichier affichée.
- **Par type** : `images`, `photos`, `captures`, `vidéos`, `clips`, `musique`, `documents` : les plus récents de ce type ; avec un mot, filtrés (`vidéo montage`).
- **Calcul** : `12*7`, `3,5 x 2`, `2(3+4)`, `2^10` ; Entrée copie le résultat.
- **Web** : toujours en dernière ligne (Google).

**Laissés hors de l'index** : dossiers système (Windows, Program Files, ProgramData, AppData, corbeille), dossiers cachés, `node_modules`, `site-packages`, `steamapps`, Xbox Games, et ce qui est généré : caches (`CACHEDIR.TAG`, dont les `target` de Rust), environnements Python (`pyvenv.cfg`), `Library` de Unity, installations d'Unreal Engine (`Engine/Build/Build.version`, 560 000 fichiers ici).

## Automatique

- `cargo test` : désinstalleurs écartés, exclusions par nom et par contenu, chemins reconstruits, score des noms, accents (y compris un accent séparé de la lettre), types et « les plus récents ».
- `cargo test --release -- --ignored --nocapture` : mesure sur les vrais disques (taille, temps, images et vidéos retrouvées).
- `pnpm test` : recherche d'applis, calcul, composition de la liste (calcul, 3 applis, fichiers, web ; 7 lignes au plus).

## Vérifié le 29/10/2026

| Point | Résultat |
|---|---|
| Index | 508 700 entrées, 35 Mo, 27 à 43 s ; recherche 10 à 40 ms (version optimisée) |
| Images et vidéos | 50 055 images, 7 433 vidéos indexées ; échantillons retrouvés par leur nom |
| `images` / `videos` | Les plus récentes d'abord (captures Medal du jour) |
| Barre | S'affiche ; avec un raccourci simulé, Listary a pris le clavier : corrigé (prise du premier plan au moment du raccourci, fermeture seule si Windows refuse) |

## Manuel

- [ ] Le raccourci ouvre la barre et on peut taper tout de suite.
- [ ] `spo` puis Entrée ouvre Spotify ; Échap rend le clavier à la fenêtre d'avant.
- [ ] `12*7`, Entrée, puis Ctrl+V ailleurs colle 84.
- [ ] Le nom d'un fichier : il apparaît, Entrée l'ouvre, Ctrl+Entrée le montre dans son dossier.
- [ ] `images`, `vidéos` : les plus récentes en premier.
