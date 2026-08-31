# Format d'un pack « liste audio »

Ce format n'est documenté nulle part. Ce qui suit est **relevé sur un pack réel qui
fonctionne** — `contes-de-la-mere-pauline` du store Litteratureaudio, 5 chapitres — et
recoupé avec le générateur de Telmi-Sync (`StoreBuild.js`).

C'est le seul format que Telmi Store fabrique. Les histoires interactives, avec leurs
graphes de plusieurs centaines de nœuds, sont hors périmètre.

## Arborescence

```
<pack>/
├── metadata.json          ← marqueur
├── nodes.json             ← marqueur
├── notes.json
├── cover.png              512 × 512   la vignette de la conteuse
├── title.png              640 × 480   marqueur
├── title.mp3              marqueur — le titre du pack, dit à voix haute
├── audios/
│   ├── q.mp3              la question du menu, dite à voix haute
│   ├── m0.mp3 … mN.mp3    le titre de chaque chapitre, dit à voix haute
│   └── s0.mp3 … sN.mp3    les chapitres eux-mêmes
└── images/
    └── m0.png … mN.png    640 × 480, une image par chapitre
```

⚠️ **`ConvertZip.js` n'accepte l'archive que si les quatre marqueurs — `metadata.json`,
`nodes.json`, `title.mp3`, `title.png` — sont présents dans un même dossier.** Il en faut
exactement quatre : trois ne suffisent pas. Le dossier peut porter n'importe quel nom,
ou ne pas exister (fichiers à la racine du zip) : les deux ont été validés.

## metadata.json

```json
{
  "title": "Contes de la mère Pauline",
  "uuid": "fffffb-19c420b4422",
  "image": "cover.png",
  "version": 13,
  "category": "Pack d'histoires",
  "description": "…",
  "age": 7
}
```

- **`version` doit être un entier ≥ 1.** Absente ou à 0, Telmi-Sync la normalise à `0`
  puis évalue `version_locale >= 0`, toujours vrai : l'histoire est grisée dès la première
  installation et **ne recevra jamais de mise à jour**. Dix des trente histoires du store
  officiel sont dans ce cas.
- `uuid` doit être unique et stable dans le temps. Les packs officiels utilisent
  `<préfixe>-<horodatage en base 16>`.
- Le format réel est plus tolérant que celui-ci : le pack de référence porte `"age": "7"`
  en chaîne et n'a pas de `category`. On écrit propre, on lit large.

## nodes.json

La machine à états. Trois entrées à la racine : `startAction`, `stages`, `actions`.

Pour **N chapitres**, le graphe est entièrement mécanique :

```json
{
  "startAction": { "action": "q", "index": 0 },
  "stages": {
    "backStage": { "image": null, "audio": null,
      "ok":   { "action": "backChildAction", "index": 0 },
      "home": { "action": "backAction", "index": 0 },
      "control": { "ok": true, "home": false, "autoplay": true } },

    "q": { "image": null, "audio": "q.mp3",
      "ok":   { "action": "m", "index": 0 },
      "home": { "action": "backAction", "index": 0 },
      "control": { "ok": true, "home": true, "autoplay": true } },

    "m<n>": { "image": "m<n>.png", "audio": "m<n>.mp3",
      "ok":   { "action": "s<n>", "index": 0 },
      "home": { "action": "backAction", "index": 0 },
      "control": { "ok": true, "home": true, "autoplay": false } },

    "s<n>": { "image": null, "audio": "s<n>.mp3",
      "ok":   { "action": "m", "index": "(n + 1) modulo N" },
      "home": { "action": "m", "index": "n" },
      "control": { "ok": false, "home": true, "autoplay": true } }
  },
  "actions": {
    "q": [{ "stage": "q" }],
    "m": [{ "stage": "m0" }, { "stage": "m1" }, "… un par chapitre"],
    "s<n>": [{ "stage": "s<n>" }],
    "backAction": [{ "stage": "backStage" }],
    "backChildAction": []
  }
}
```

Ce qui se passe à l'usage :

1. Au démarrage, la question est lue (`autoplay`), puis on arrive sur le premier chapitre.
2. Sur un `m<n>`, l'enfant voit l'image et entend le titre. Les flèches parcourent le menu
   — c'est l'`action` « m » qui est la liste, et l'`index` qui s'y déplace.
3. **OK** lance le chapitre. `control.ok` y passe à `false` : on ne peut plus sauter en
   avant pendant l'écoute.
4. À la fin du chapitre, `ok` renvoie au menu sur l'entrée suivante — et le **dernier
   chapitre renvoie à l'index 0**. Le menu boucle.
5. **HOME** depuis un chapitre revient sur son entrée de menu ; depuis le menu, il sort par
   `backAction`.

`backStage` et `backChildAction` sont à recopier tels quels : c'est la conteuse qui les
utilise pour son bouton retour.

## notes.json

Purement documentaire, affiché dans le Studio de Telmi-Sync. Une entrée par stage :

```json
{
  "q":    { "title": "Question", "notes": "Quelle histoire veux-tu écouter ?" },
  "m<n>": { "title": "m<n>", "notes": "<titre du chapitre>" },
  "s<n>": { "title": "<titre du chapitre>", "notes": "" }
}
```

## Audio

Format relevé sur le pack de référence, donc **prouvé compatible** :

| | |
| --- | --- |
| Codec | mp3 |
| Échantillonnage | 44 100 Hz |
| Canaux | stéréo |
| Débit | variable d'un fichier à l'autre : 96, 128 et 192 kb/s coexistent dans le même pack |

Le débit n'est donc pas contraint. Un mp3 de podcast ordinaire devrait passer tel quel,
ce qui permet d'éviter tout ré-encodage des chapitres — le gros du poids.

⚠️ **Non vérifié sur une conteuse réelle** : le comportement avec du VBR, du 48 kHz ou du
mono. Tant que ce n'est pas testé sur matériel, l'application doit lire l'échantillonnage
et le nombre de canaux, et prévenir quand ils sortent de 44 100 Hz stéréo.

## Images

Générées par Telmi-Sync avec `scale=<L>x<H>:flags=bilinear`, plus un `drawtext` optionnel
pour incruster le titre et la pagination, en police Exo 2.

| Fichier | Taille | Poids observé |
| --- | --- | --- |
| `cover.png` | 512 × 512 | ~500 Ko |
| `title.png` | 640 × 480 | ~700 Ko |
| `images/m<n>.png` | 640 × 480 | 0,8 à 2 Mo |

Ces poids viennent d'un encodage PNG *truecolor* non optimisé. `-pix_fmt pal8` les
diviserait par cinq environ, sans changer de format.

**Mais ça ne vaut pas l'effort ici** : dans un pack « liste audio », il y a une image par
chapitre, soit quelques mégaoctets face à plusieurs centaines pour l'audio. L'optimisation
des images n'a d'intérêt que pour les packs interactifs, où l'on compte 247 images pour
298 audios — et ceux-là, on ne les fabrique pas.
