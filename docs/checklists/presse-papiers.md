# Presse-papiers, vérifications

Historique de ce qui est copié pendant la session, dans un onglet de l'île. Choix validés le 29/10/2026 :
- un clic **recopie** l'élément (pas de collage automatique) ;
- l'historique dure **le temps de la session** : rien n'est écrit sur le disque, rien n'est journalisé ;
- un aperçu discret « Copié » à chaque copie.

30 éléments non épinglés au plus, dont 10 images ; les épinglés restent. « Vider » garde les épinglés. Un texte de plus de 1 Mo n'est pas gardé.

**Confidentialité :** une copie marquée privée par l'application (`ExcludeClipboardContentFromMonitorProcessing`, `Clipboard Viewer Ignore`, ou `CanIncludeInClipboardHistory` à 0) n'est jamais lue. Ce sont les signaux qu'utilisent Bitwarden, 1Password, KeePass… et que respecte l'historique de Windows (Win+V).

## Automatique

- `cargo test` : ordre (plus récent d'abord), une copie identique remonte au lieu d'être doublée, limites (30 éléments, 10 images, épinglés hors limite), vider garde les épinglés, reconnaissance des liens et du site, aperçu sur une ligne, miniature (moyenne des pixels, proportions), aller-retour PNG.
- `pnpm test` : « il y a 5 min », épinglés d'abord, onglets proposés.

## Vérifié le 29/10/2026 (fenêtre réelle, copies faites par un script PowerShell)

| Point | Résultat |
|---|---|
| Texte copié | Ajouté, aperçu « Copié » sur l'île |
| Lien copié | Reconnu, site affiché (github.com) |
| Copie marquée `ExcludeClipboardContentFromMonitorProcessing` | **Ignorée** |
| Image copiée (320 × 200) | Ajoutée avec sa miniature |
| Clic sur un élément | Revient dans le presse-papiers, remonte en tête, pas de doublon |
| Onglet | Apparaît avec le nombre d'éléments, « Vider » |

## Manuel

- [oui] Copier un texte (Ctrl+C) : aperçu « Copié » avec le début du texte.
- [oui] Copier un lien depuis le navigateur : carte avec le site et l'adresse.
- [oui] Capture Win+Maj+S : carte avec la miniature ; un clic puis Ctrl+V dans Discord colle l'image.
- [oui] Copier un mot de passe depuis Bitwarden ou un autre gestionnaire : **rien** n'apparaît.
- [oui] Épingler un élément, puis « Vider » : seul l'épinglé reste.
- [oui] Copier deux fois la même chose : une seule carte, remontée en tête.
- [oui] Fermer et rouvrir Quiera : l'historique est vide.

## Limites connues

- Les fichiers copiés dans l'Explorateur ne sont pas gardés (le Shelf est fait pour ça).
- Le texte mis en forme est gardé en texte brut.
