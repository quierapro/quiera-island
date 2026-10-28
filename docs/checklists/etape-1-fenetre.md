# Étape 1 : fenêtre de l'île, vérifications

À refaire après toute modification de `src-tauri/src/island/` ou de `src-tauri/src/platform/windows/`.

## Automatique

Lancer la version optimisée, puis le script :

```powershell
pnpm tauri build --no-bundle
.\src-tauri\target\release\quiera.exe
powershell -ExecutionPolicy Bypass -File scripts\verify-island.ps1
```

Le script déplace la souris et ouvre une fenêtre grise pendant 2 à 3 secondes : ne pas toucher la souris pendant ce temps.

| Vérification | 27/10/2026 (Windows 11, 1920 × 1080, 100 %) |
|---|---|
| Styles `TOOLWINDOW`, `NOACTIVATE`, `LAYERED`, `TOPMOST`, sans `APPWINDOW` | OK |
| Fenêtre en haut au centre (620,0)-(1300,380) | OK |
| Région limitée à la pilule : (230,0)-(450,32) | OK |
| Clic sur la pilule : le focus reste à l'application active | OK |
| Clic à côté de la pilule : il atteint la fenêtre du dessous | OK |
| Mémoire privée (Quiera et WebView2, 7 processus) | 147 Mo |
| CPU au repos sur 30 s | 0,02 % |

Répartition de la mémoire privée : processus GPU de WebView2 64 Mo, navigateur 31 Mo, rendu de la page 25 Mo, réseau 11 Mo, stockage 7 Mo, Quiera (Rust) 6 Mo.

## Manuel (à cocher par un humain)

- [oui] La pilule est visible en haut au centre : noire translucide, collée au bord, avec les deux petits évasements.
- [oui] Aucun rectangle ni contour autour de la pilule.
- [oui] Pas de bouton dans la barre des tâches ; Quiera n'apparaît pas dans Alt+Tab.
- [oui] L'icône de la zone de notification ouvre un menu, et « Quitter Quiera » ferme l'application.
- [je sais pas] Relancer `quiera.exe` alors qu'il tourne déjà : rien ne s'ouvre en double.
- [je sais pas mais j ai aucun patametrer ] Changer l'échelle (Paramètres > Affichage > Échelle 125 %) : la pilule reste centrée, à la bonne taille, et nette.
- [oui] Une fenêtre agrandie (maximisée) : la pilule reste par-dessus.

## Non couvert par cette étape

Plein écran, plusieurs écrans, veille et reprise, redémarrage d'Explorer : étape 3.
