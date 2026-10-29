# Contrôles rapides et « Ne pas déranger », vérifications

Un onglet **Contrôles** (toujours proposé, donc la barre d'onglets apparaît à chaque ouverture du panneau) :
- **Wi-Fi** et **Bluetooth** : un clic active ou coupe la radio ;
- **sortie audio** : les sorties en pastilles, celle en service d'abord et en blanc ; un clic change la sortie par défaut de Windows (pour tous les usages : multimédia, jeux, appels) ;
- **volume général** : curseur, et le haut-parleur coupe ou remet le son ;
- **applications** : celles qui jouent du son en premier, un curseur chacune ; l'icône coupe ou remet le son de l'appli. Une appli à plusieurs processus (un navigateur) n'a qu'une ligne.

L'état est lu à l'ouverture du panneau puis toutes les 1,5 s tant que l'onglet est affiché (lecture mesurée : 43 ms). Pendant qu'on fait glisser un curseur, sa valeur l'emporte sur celle lue (1,2 s), pour qu'il ne saute pas.

**« Ne pas déranger »** (et tout mode de Windows autre que normal) : les notifications arrivent toujours dans l'onglet, mais l'île ne les annonce pas.

## Technique

- Radios : `Windows.Devices.Radios`.
- Sortie par défaut : `IPolicyConfig`, l'interface qu'utilisent les Paramètres de son ; non documentée mais stable depuis Windows 7 (SoundSwitch, EarTrumpet).
- Volumes : `IAudioEndpointVolume` (général), sessions audio `IAudioSessionManager2` + `ISimpleAudioVolume` (applis). Nom d'une appli : sa description (« Microsoft Edge »), lue une fois par appli. Icône : celle du shell, une fois par appli.
- Les commandes tournent hors du fil principal ; une appli n'est désignée que par une clé, jamais par un chemin venu de la page.

## Automatique

- `cargo test` : noms des sorties (court, sinon complet, sinon description, sinon numéro), sortie en service d'abord, Wi-Fi d'abord, clé stable par appli.
- `pnpm test` : taille du panneau, valeur du curseur pendant le glisser, onglet toujours proposé.

## Vérifié le 29/10/2026 (fenêtre réelle, lecture seule)

| Point | Résultat |
|---|---|
| Lecture de l'état | Wi-Fi et Bluetooth, 13 sorties, volume 48, 7 applis, en 43 ms |
| Commandes de volume | Renvoyer la valeur actuelle (général et applis) réussit |
| Icônes des applis | Chargées (Discord, Medal, Steam…) |
| Noms des applis | « Discord Canary », « Spotify »… (un nom avec des caractères parasites corrigé) |
| Onglet | Capture conforme ; sortie en service en premier |

Rien n'a été coupé ni changé pendant ces tests : Wi-Fi, Bluetooth et sortie sont à essayer à la main.

## Manuel

- [ ] Couper puis remettre le Bluetooth (le casque se déconnecte puis revient).
- [ ] Couper puis remettre le Wi-Fi.
- [ ] Changer de sortie (casque ↔ haut-parleurs) : le son bascule, la pastille suit.
- [ ] Faire glisser le volume général : le son suit, sans aperçu « volume » par-dessus le panneau.
- [ ] Baisser Spotify seul ; couper Discord seul avec son icône.
- [ ] Activer « Ne pas déranger » (Win+N) puis recevoir une notification : pas d'annonce sur l'île, mais elle est dans l'onglet.

## Limites connues

- Des sorties qui portent exactement le même nom dans Windows (câbles virtuels Voicemeeter) sont numérotées « 1, 2, 3… ». Les renommer dans Paramètres › Son leur donne un nom lisible dans l'île aussi.
- Le nom du réseau Wi-Fi n'est pas affiché.
