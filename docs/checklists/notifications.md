# Notifications, vérifications

Les notifications Windows arrivent sur l'île. Choix validés le 29/10/2026 :
- un aperçu d'environ 5 s avec l'icône, l'appli, le titre et le texte (le contenu est affiché en entier) ;
- survoler l'aperçu ouvre l'île directement sur l'onglet **Notifications** ;
- les contrôles rapides viendront après.

Dans l'onglet, un clic sur une notification **ouvre l'appli**, la croix la **ferme** (elle quitte aussi le centre de notifications de Windows), « Tout effacer » les ferme toutes, et les liens du texte s'ouvrent dans le navigateur (web et mail seulement). La liste suit le centre de notifications : ce qui y est fermé disparaît aussi de l'île. 50 au plus, le temps de la session, rien sur le disque ni dans le journal.

**Ce que Windows ne permet pas :** répondre directement ou appuyer sur les boutons d'une notification. Windows ne donne aux autres applis que l'appli, le titre, le texte et l'icône ; les boutons et la zone de réponse restent à l'appli qui l'a envoyée. Un clic ouvre donc l'appli pour y répondre.

**Astuce :** Paramètres › Système › Notifications › une appli › décocher « Afficher les bannières de notification » (en gardant les notifications) : Windows n'affiche plus son pop-up, et l'île prend le relais sans doublon.

## Technique

- Lecture par `UserNotificationListener`. Hors Store, Windows refuse son événement de changement : le centre est relu chaque seconde (un appel léger), d'où un délai de 1 à 2 s.
- Icône : le logo fourni par Windows (applis du Store), sinon l'icône du menu Démarrer (`shell:AppsFolder\<id>`), une fois par appli.

## Automatique

- `cargo test` : nouvelles et disparues entre deux relectures, plus récentes d'abord, limite de 50, icône partagée par appli, seuls les liens web et mail s'ouvrent (pas `file:` ni `javascript:`).
- `pnpm test` : liens repérés dans le texte (sans la ponctuation qui suit), heure d'arrivée (« 14:05 », « hier 09:30 »), survol d'une notification qui ouvre l'onglet.

## Vérifié le 29/10/2026 (fenêtre réelle, notifications envoyées par PowerShell)

| Point | Résultat |
|---|---|
| Arrivée | Aperçu sur l'île 1 à 2 s après, avec icône, appli, titre, texte |
| Onglet | Liste avec l'heure, lien en bleu, croix au survol |
| Notifications déjà là au démarrage | Ignorées |
| Fermée dans Windows | Disparaît aussi de l'île |
| Croix ou « Tout effacer » dans l'île | Disparaît aussi du centre de Windows |
| Icône d'une appli classique (PowerShell) | Icône du menu Démarrer |

## Manuel

- [ ] Un message Discord (ou WhatsApp, Messenger…) : aperçu avec l'icône, le nom de la personne et le message.
- [ ] Survoler l'aperçu : l'île s'ouvre sur l'onglet Notifications.
- [ ] Cliquer une notification : l'appli s'ouvre.
- [ ] Un lien dans un message : il s'ouvre dans le navigateur.
- [ ] La croix : la notification disparaît aussi du centre de Windows (Win+N).
- [ ] Une notification fermée dans Win+N disparaît aussi de l'île.
- [ ] Couper les bannières d'une appli dans Windows : seule l'île l'annonce.
- [ ] Mode « Ne pas déranger » de Windows : à observer (Windows garde les notifications dans le centre sans bannière ; l'île les annonce quand même pour l'instant).
