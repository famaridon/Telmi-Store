# Telmi Store

Application de bureau qui permet de **proposer une histoire à un store Telmi, et de
modérer les propositions reçues — sans jamais voir git ni GitHub.**

C'est le compagnon de [Telmi-Sync](https://github.com/DantSu/Telmi-Sync) : Telmi-Sync
fabrique et transfère les packs vers la conteuse, Telmi Store s'occupe de les publier et
de les faire circuler.

## Dix histoires plutôt que cinq cents

**L'objectif n'est pas la taille du catalogue, c'est qu'un enfant redemande l'histoire.**

Mieux vaut dix histoires réclamées le soir que cinq cents podcasts que l'enfant zappe
fébrilement. Un enfant qui zappe est un enfant qui n'a rien trouvé — et une conteuse qui
propose trois cents entrées ne l'aide pas à choisir, elle l'écrase.

La quantité, d'ailleurs, est un problème déjà résolu : Telmi-Sync donne accès en deux clics
à un annuaire de **174 flux de podcasts**. Personne n'a manqué de contenu. Ce qui manque,
c'est le tri.

Ce projet part donc d'un renversement : **la modération n'est pas un goulot administratif à
minimiser, c'est le produit.** On rend le dépôt facile précisément pour que la relecture
puisse rester exigeante. Refuser une proposition est un acte normal, fréquent et attendu —
l'application doit rendre « non, et voici pourquoi » aussi simple que « oui ».

C'est aussi la raison pour laquelle un store est un dépôt git avec des *pull requests* et
non un formulaire qui publie : la curation devient un acte traçable, discutable, et
réversible.

## Le problème

Créer un store Telmi demande aujourd'hui une organisation GitHub, un dépôt de
configuration, une bannière à composer sous GIMP, un gist secret, un jeton d'accès sans
expiration, un projet Deno Deploy avec un CRON, puis un dépôt par histoire dont les
métadonnées se saisissent à la main dans la description d'une release.

Le résultat, mesuré sur l'écosystème existant :

| | |
| --- | --- |
| Stores réellement existants | **4** |
| Histoires au total | **39**, dont 30 dans le seul store officiel |
| Organisations GitHub créées puis abandonnées avant la première histoire | **2 sur 6** |
| Téléchargements cumulés | **41 245** — la demande existe |

Deux personnes ont monté tout le décor puis n'ont jamais publié une seule histoire. Les
deux stores étrangers plafonnent à une et deux histoires. Le seul store vivant est
maintenu par l'auteur de la procédure, c'est-à-dire par la personne pour qui la friction
est nulle.

Le problème n'est pas qu'il y ait peu d'histoires : c'est que **la friction filtre les
mauvaises personnes**. Elle n'écarte pas le contenu médiocre, elle écarte le parent, la
bibliothécaire ou l'institutrice qui auraient apporté les dix histoires qui comptent.

Or le format attendu par Telmi-Sync est trivial : un `GET` qui renvoie
`{banner, data[]}`. Toute cette procédure n'existe que pour produire un fichier JSON
statique. **La complexité n'est pas dans le besoin, elle est dans la tuyauterie.**

## Ce que fait l'application

**Pour qui veut partager une histoire.** Choisir une histoire de sa bibliothèque
Telmi-Sync, remplir cinq champs, cliquer sur Envoyer. L'application publie le pack dans
un dépôt qui appartient au contributeur, puis ouvre une *pull request* sur le store avec
une fiche de deux kilo-octets. Le contributeur suit ensuite l'état de sa proposition —
en relecture, acceptée, refusée — sans quitter l'application.

**Pour qui maintient un store.** La liste des propositions ouvertes, avec trois gestes :
*Écouter* installe le pack localement, *Accepter* fusionne, *Refuser* ferme avec un
commentaire. Aucun pack à fabriquer, aucun fichier à transférer, aucune ligne de commande.

**Pour tout le monde.** Un store dont chaque entrée a été écoutée par quelqu'un avant
d'y figurer.

## Ce que ce n'est pas

- **Pas un remplaçant de Telmi-Sync.** L'application lit sa bibliothèque en seule
  lecture et ne touche jamais à `~/.telmi`.
- **Pas un hébergeur.** Un store ne détient aucune copie d'œuvre : chaque pack reste dans
  le dépôt de son auteur, et le store n'en garde que l'adresse. Un retrait de contenu
  supprime une ligne d'index, pas un fichier.
- **Pas un modificateur de Telmi-Sync.** Le modèle a été validé de bout en bout avec le
  vrai code de l'application : un dépôt git nu est consommé tel quel, sans modifier une
  ligne. Voir [famaridon/telmi-store-dev](https://github.com/famaridon/telmi-store-dev).

## Le modèle de store

```
mon-store/                        ← un dépôt public = un store
├── index.json                    ← GÉNÉRÉ : le {banner, data[]} servi à Telmi-Sync
├── histoires/<slug>.json         ← une fiche par histoire, ~2 Ko
├── vignettes/<slug>.png          ← ~25 Ko
└── .github/workflows/            ← valide les fiches, régénère l'index, sonde les liens
```

Le pack, lui, vit ailleurs :
`github.com/<auteur>/<son-dépôt>/releases/download/<tag>/pack.zip`

Mille histoires tiennent dans 27 Mo de dépôt. Les octets lourds passent par les
*releases*, le seul espace de GitHub dont la documentation dit « there is no limit on the
total size of a release, nor bandwidth usage ».

## État d'avancement

Amorçage. La coquille Electron + React + TypeScript est en place, avec une première
tranche réelle : la lecture de la bibliothèque locale de Telmi-Sync, qui est l'entrée de
tout le reste.

Ce qui reste à écrire est découpé dans [projet.md](projet.md), et l'architecture cible
est décrite dans [docs/archi.md](docs/archi.md).

## Démarrer

```sh
npm install
npm run dev          # lance l'application avec rechargement à chaud
npm run test         # règles du domaine, adaptateurs, barrière d'architecture
npm run typecheck    # vérifie les trois cibles
npm run build        # compile main, preload et renderer
npm run apercu       # capture les écrans dans outils/apercu/, sans souris
npm run dist:mac     # produit un .dmg
```

La connexion GitHub fonctionne sans configuration : l'identifiant de l'OAuth App est
commité, parce qu'un `client_id` est public par conception et qu'aucun secret client
n'intervient dans le Device Flow. Pour viser une autre application — un fork, un test —
`TELMI_STORE_GITHUB_CLIENT_ID=… npm run dev`.

Node 22.13 ou plus récent.

## À propos du contenu

Cette application ne collecte rien et n'embarque aucun contenu : elle fabrique un pack à
partir de ce qu'un contributeur dépose, et publie une fiche. Récupérer des audios libres —
flux de podcasts, archive.org, domaine public — est un travail à part, mené avec ses propres
outils, hors de ce dépôt.

Ce qui compte ici est l'étape d'après : **choisir, dans ce qui existe, les quelques
histoires qui méritent d'être proposées.** Voir « Dix histoires plutôt que cinq cents »
plus haut.
