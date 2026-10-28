# Aperçus système, vérifications

Courts aperçus (~2,2 s) quand le système change : chargeur branché ou débranché, sortie audio qui change (casque, écouteurs, enceinte, avec la batterie quand Windows la connaît), Verr. Maj et volume. Un aperçu du même type remplace celui à l'écran : maintenir la touche volume fait glisser la barre au lieu d'empiler les aperçus. Panneau ouvert : pas d'aperçu, il montrerait ce qu'on voit déjà.

Le journal ne garde que le **type** d'aperçu (« caps lock », « audio device »…), jamais le nom de l'appareil ; le volume n'y est pas écrit.

## Automatique

- `cargo test` : aperçu du chargeur seulement quand le branchement change et seulement s'il y a une batterie (pas sur un PC fixe), pourcentage inconnu, conversion du volume Windows (0,0–1,0) en pourcentage, format envoyé à l'interface.
- `pnpm test` : la machine à états des aperçus, partagée avec le lecteur (durée, survol qui les garde, panneau ouvert qui les ignore).

## Vérifié le 28/10/2026 (fenêtre réelle)

| Point | Résultat |
|---|---|
| Verr. Maj activé | Aperçu « Verr. Maj » avec point vert, 220 × 38 |
| Verr. Maj désactivé | Même aperçu, point gris |
| Pendant une musique | L'aperçu remplace les paroles ~2,2 s puis le lecteur revient |
| Volume | Barre et valeur (45, puis 42) ; la barre glisse d'une valeur à l'autre |
| Sortie audio | Un aperçu à chaque vrai changement de sortie par défaut ; aucun si Windows répète la même |

## Manuel

- [ ] Brancher le chargeur : « En charge », batterie verte qui pulse, éclair, pourcentage.
- [ ] Le débrancher : « Sur batterie » et le pourcentage.
- [ ] Connecter un casque Bluetooth : « Connecté », son nom, anneau de batterie (orange sous 20 %).
- [ ] Brancher un casque filaire ou passer sur les haut-parleurs : aperçu sans batterie.
- [ ] Touches volume du clavier : la barre suit ; maintenue, elle glisse sans clignoter.
- [ ] Touche muet : icône barrée, barre vide.
- [ ] Verr. Maj plusieurs fois de suite : l'aperçu reste et le point change.
- [ ] Survoler un aperçu : il reste tant que la souris est dessus.

## Limites connues

- La batterie d'un casque n'apparaît que si Windows la connaît (elle s'affiche aussi dans Paramètres › Bluetooth). Beaucoup de casques la donnent ; certains non, ou seulement quelques secondes après la connexion.
- Verr. Maj est lu toutes les 150 ms (Windows n'envoie pas d'événement sans crochet clavier global, que Quiera évite).
- La luminosité n'a pas d'aperçu pour l'instant.
