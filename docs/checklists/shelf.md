# Shelf, vérifications

Fichiers déposés sur l'île, gardés pour plus tard et glissés ailleurs. Les fichiers sont gardés **par référence** (leur chemin), jamais copiés ; le Shelf dure le temps de la session, 30 éléments au plus.

## Automatique

- `cargo test` : ajout sans doublon et du plus récent au plus ancien, limite de 30, retrait, vidage, fichiers disparus, type (image / dossier / fichier), conversion des pixels Windows et encodage PNG.
- `cargo test -- --ignored` : vraies miniatures du Shell Windows (image, texte, dossier, Markdown, chemin avec `/`).
- `pnpm test` : onglets et glisser-déposer dans la machine à états, fermeture après un dépôt, formats de taille.

## Vérifié le 28/10/2026 (fenêtre réelle, fichiers ajoutés par la commande de développement `dev_shelf_add`)

| Point | Résultat |
|---|---|
| Barre d'onglets | Apparaît dès qu'il y a un élément ; onglet Shelf avec le nombre |
| Panneau | 586 × 182 ; tuiles avec nom et taille |
| Miniatures | Les mêmes que l'Explorateur : image 256 px, dossier, document, Markdown |
| Icône de glisser | PNG créé dans le cache de l'application |

**Corrigé en route :** les miniatures étaient générées dans plusieurs fils à la fois ; le générateur d'aperçu Markdown installé échouait alors. Elles passent maintenant par un seul fil, l'une après l'autre.

## Manuel

- [oui] Glisser un fichier depuis l'Explorateur sur la pilule : l'île s'ouvre sur le Shelf, la zone de dépôt s'allume.
- [oui] Le lâcher : la tuile apparaît ; l'île se referme ~2 s plus tard si la souris n'est pas dessus.
- [oui] Glisser puis repartir sans lâcher : l'île se referme.
- [oui] Plusieurs fichiers d'un coup, un dossier, une image, un PDF : bonnes miniatures.
- [oui] Clic sur une tuile : le fichier s'ouvre avec son application.
- [oui] Clic droit : l'Explorateur s'ouvre sur le fichier.
- [oui] Glisser une tuile vers le bureau, un dossier, Discord ou un mail : le fichier est **copié** (l'original reste en place).
- [oui] Croix sur une tuile : l'élément quitte le Shelf (le fichier n'est pas supprimé du disque).
- [oui] « Vider » : le Shelf est vide, la barre d'onglets disparaît.
- [oui] Supprimer un fichier du disque puis rouvrir le Shelf : sa tuile disparaît.

## Limites connues

- Seuls les **fichiers** sont acceptés : un texte sélectionné glissé depuis une page n'est pas reçu (Tauri ne transmet que des chemins). À traiter avec le presse-papiers.
- Il faut viser la pilule pour déposer : elle est petite au repos.
- Le Shelf se vide à la fermeture de Quiera (réglage pour le garder : étape 5).
