# Envoyer au téléphone, vérifications

Depuis le Shelf : le bouton bleu (téléphone) d'une tuile, ou « Envoyer au téléphone » / « Tout envoyer au téléphone » en haut, ouvre un QR code. L'appareil photo du téléphone l'ouvre, et la page propose chaque fichier à télécharger (les photos s'affichent aussi : un appui long les ajoute aux photos). « Partager avec Windows » ouvre le panneau Partager de Windows avec les mêmes fichiers.

## Comment ça marche

- Quiera sert les fichiers sur le **réseau local**, à une adresse du type `http://192.168.x.x:port/s/<jeton>` : rien ne passe par Internet.
- Le jeton est aléatoire (128 bits) ; seuls les fichiers proposés sont servis, rien d'autre du PC.
- Un lien marche **10 minutes**, puis la page dit qu'il a expiré.
- Le serveur ne démarre qu'au premier envoi : Windows demande alors d'autoriser Quiera sur le réseau. Il faut accepter (réseau privé), sinon le téléphone ne joint pas le PC.
- Les dossiers ne s'envoient pas (pas de bouton sur leur tuile).

## Automatique

- `cargo test share` : routes (page, fichier, aperçu d'image), refus de tout ce qui n'a pas été proposé (index, `..`, chemins), expiration, jetons, QR code, noms échappés (HTML, en-têtes), tailles, et un vrai échange HTTP en local (page, téléchargement, HEAD, lien expiré, 404, 405).
- `pnpm test` : compte à rebours.

## Manuel

- [oui] Déposer une photo et un PDF sur l'île › onglet Shelf › survoler la photo : bouton bleu en haut à gauche, croix en haut à droite.
- [oui] Bouton bleu : un QR code, le nom du fichier, « expire dans 10:00 » qui décompte.
- [oui] Premier envoi : Windows demande l'accès réseau pour Quiera › Autoriser.
- [oui] Scanner avec un iPhone (même Wi-Fi) : la page « Envoyé depuis Quiera » s'ouvre ; « Télécharger » enregistre le fichier ; appui long sur la photo › « Ajouter à Photos ».
- [oui] Même chose avec un Android.
- [oui] « Tout envoyer au téléphone » : la page liste tous les fichiers (pas les dossiers).
- [oui] « Partager avec Windows » : le panneau Partager s'ouvre avec le ou les fichiers (Lien avec Windows, Quick Share, partage de proximité selon ce qui est installé).
- [oui] Après 10 minutes, la page sur le téléphone dit « Ce lien a expiré » ; dans l'île, « Nouveau code » en refait un.
- [oui] Téléphone sur un autre réseau (4G) : la page ne s'ouvre pas (normal, c'est local).
- [oui] « Retour » revient aux tuiles.
