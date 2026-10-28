# Étape 2 : états et animations, vérifications

## Automatique

```sh
pnpm test                         # machine à états, contrôleur, géométrie, région, ressorts
QUIERA_BENCH=1 pnpm tauri dev     # mesure des images dans la vraie fenêtre, résultat dans le journal
```

Le journal est dans `%LOCALAPPDATA%\app.quiera\logs\Quiera.log` (lignes `[dev] bench`).

### Temps entre deux images, WebView2, écran à environ 180 Hz (5,6 ms), 28/10/2026

Chaque transition est mesurée pendant 700 ms. « Premier passage » = la première fois après le lancement ; « suivants » = toutes les fois d'après.

| Transition | Premier passage : pire image | Suivants : pire image | Images > 20 ms (suivants) |
|---|---|---|---|
| Repos | 39–116 ms (démarrage) | 5,8 ms | 0 |
| Repos → activité | 39–189 ms | 6–11 ms | 0 |
| Activité → aperçu | 22–33 ms | 5,8–11 ms | 0 |
| Ouverture | 5,9–11 ms | 5,8 ms | 0 |
| Fermeture | 5,8–17 ms | 5,8 ms | 0 |
| Masquer / afficher | 5,9 ms | 5,9 ms | 0 |

**Défaut connu :** la toute première apparition de contenu après le lancement saccade (une à quatre images lentes), puis plus jamais. Ces mesures viennent du mode développement (React non optimisé). Un préchauffage pendant l'animation de naissance a été essayé et n'a rien amélioré, il a donc été retiré. À remesurer en version optimisée.

**Décision sur le flou :** le flou d'entrée du contenu est gardé pour l'activité et l'aperçu (petits contenus). Le panneau développé entre par un léger agrandissement, de 98 % à 100 %, sans flou. Avec le flou, des images de 50 à 95 ms apparaissaient en rendu logiciel.

## Manuel (avec `pnpm tauri dev`, panneau de débogage en bas de la fenêtre)

- [oui] Au lancement : une bulle monte, touche le bord, s'étire en pilule et les évasements apparaissent.
- [oui] Survol de la pilule : elle grossit légèrement après un court instant ; en sortant, elle revient.
- [oui] Clic sur la pilule : le panneau s'ouvre avec un léger rebond ; en sortant le curseur, il se referme calmement, sans rebond.
- [oui] 20 entrées et sorties rapides au bord de la pilule : pas de scintillement, pas de blocage ouvert.
- [oui] Inverser en plein geste (cliquer pour ouvrir, ressortir aussitôt) : la pilule repart sans à-coup.
- [oui] « Musique » : la pilule s'élargit pour l'activité. « Aperçu » : elle s'agrandit 2 s, puis revient à l'activité.
- [oui] Survoler pendant un aperçu : l'aperçu reste tant que le curseur est dessus.
- [oui] « Masquer » / « Afficher » : la pilule rentre dans le bord puis ressort.
- [oui] « Ralenti » : tout se joue quatre fois plus lentement, avec la même forme de mouvement.
- [oui] « Région » : le contour rose suit la pilule ; en dehors, les clics passent aux fenêtres du dessous.
- [oui] Le contenu n'apparaît jamais avant que la forme ait commencé à bouger, et ne déborde jamais de la pilule.
