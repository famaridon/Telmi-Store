# Deux contributions à proposer à Telmi-Sync

Ces deux changements concernent **Telmi-Sync**, pas Telmi Store. Ils sont écrits ici
parce qu'ils ont été trouvés et mesurés en construisant cette application, et qu'ils
valent d'être proposés à [DantSu](https://github.com/DantSu/Telmi-Sync) — mais ce n'est
pas notre dépôt, donc la décision et la pull request lui appartiennent.

Elles sont indépendantes l'une de l'autre, et de Telmi Store.

---

## 1. Les images d'étape font 5 fois leur taille nécessaire

**Un drapeau ffmpeg. Aucun changement de format, rien à modifier sur la conteuse.**

### Le constat

Dans un pack interactif, les images d'étape sont **76 % du poids total**. Mesuré sur
« Le trésor de Calico Jack », le plus gros pack du store officiel :

```
247 images s*.png · 640×480 truecolor · 584 Ko de moyenne (jusqu'à 841 Ko)
= 140,9 Mo sur les 185,6 Mo du pack
```

Elles sont produites par `convertImageToPng` en truecolor, parce que c'est le défaut de
ffmpeg. Or ce sont des illustrations affichées sur un petit écran.

### Le comparatif, mesuré avec le ffmpeg 6.1 que Telmi-Sync télécharge lui-même

| Encodage | Poids | Gain | Format |
| --- | --- | --- | --- |
| actuel | 840 Ko | — | PNG |
| `-compression_level 100` seul | 840 Ko | **0 %** | PNG |
| **`-pix_fmt pal8`** | **166 Ko** | **5,1 ×** | **PNG — rien à changer côté Telmi OS** |
| JPEG q4 | 138 Ko | 6,1 × | changement de format |
| WebP q80 | 110 Ko | 7,6 × | changement de format |

Le lossless seul ne donne rien : le gain vient de la palette.

### Le changement

Dans `public/MainEvents/Processes/BinFiles/FFmpegCommand.js`, fonction
`convertImageToPng` :

```diff
-        stream = spawn(getFFmpegFilePath(), ['-i', srcFile, '-vf', 'scale=' + width + 'x' + height + ':flags=bilinear' + textCommand + pageCommand, dstPng])
+        stream = spawn(getFFmpegFilePath(), ['-i', srcFile, '-vf', 'scale=' + width + 'x' + height + ':flags=bilinear' + textCommand + pageCommand, '-pix_fmt', 'pal8', dstPng])
```

### Ce que ça donne

Le plus gros pack passe de **183 à environ 72 Mo**. Le store officiel de 1,7 Go à environ
700 Mo, et sa bande passante d'environ 90 à 36 Go par mois.

### Les deux réserves, à trancher par DantSu

- **256 couleurs.** Du *dithering* peut apparaître sur des dégradés. Ça demande un
  **contrôle visuel sur l'écran de la conteuse** avant d'être adopté — c'est un jugement
  esthétique, pas une mesure.
- Ça ne s'applique qu'aux **nouveaux packs**. Les existants demanderaient une
  régénération.

---

## 2. Vérifier l'empreinte d'un pack téléchargé

**Le seul point de tout le modèle de store contributif qui demande un changement dans
Telmi-Sync.**

### Le problème

Un asset de release GitHub est **remplaçable sous le même tag**. Dans un store où les
packs restent chez leurs auteurs — ce que Telmi Store fait, et ce qui évite au store
d'héberger la moindre œuvre — rien n'empêche donc un auteur de substituer un autre contenu
après la modération.

Les fiches produites par Telmi Store portent déjà l'empreinte :

```json
"pack": { "type": "pack-release", "sha256": "46ac1c…", "taille": 88411 }
```

Il manque le côté qui la vérifie.

### Le changement

Dans `Stores.js`, la normalisation de `store-remote-get` laisse déjà passer tous les
champs inconnus. Il suffirait de :

1. conserver `sha256` et `taille` dans la normalisation, comme les autres champs
   optionnels ;
2. dans `StoreDownload.js`, calculer le sha-256 pendant le téléchargement — le flux passe
   déjà par `downloadFile` — et comparer avant d'appeler `convertZip` ;
3. en cas d'écart, écrire une erreur plutôt que d'installer.

C'est une dizaine de lignes, et ça ne casse rien : une fiche sans `sha256` continue de
s'installer comme aujourd'hui.

### Pourquoi ça vaut le coup même sans store contributif

Ça détecte aussi un téléchargement tronqué, qui aujourd'hui produit une histoire
silencieusement incomplète.

---

## Ce qui n'est pas ici

Deux autres idées ont été écartées **pour Telmi-Sync** après mesure :

- **Servir les packs par `codeload`** (l'archive d'un dépôt) fonctionne — vérifié, un
  dossier racine et des `README` à côté ne perturbent pas la détection — mais c'est un
  usage à contre-emploi pour distribuer 90 Go/mois de médias, alors que les releases sont
  faites pour ça.
- **Livrer du `FORMAT_AUDIO_LIST`** plutôt que du `FORMAT_TELMI` supprimerait beaucoup de
  travail côté contributeur, mais `ConvertFolderAudioList.js` **régénère un `uuid` et remet
  `version` à 0 à chaque import** : la détection de mise à jour serait perdue. C'est aussi,
  au passage, pourquoi dix histoires sur trente du store officiel ne peuvent aujourd'hui
  jamais être mises à jour — il leur manque simplement `"version": 1`.
