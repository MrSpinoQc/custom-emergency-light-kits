# Installer Hellfire Police V08

> [!NOTE]
> **Archive.** Ce guide accompagne la version indiquée ci-dessous. [Installer la préversion actuelle](../0.3.1/INSTALLATION.md)

**CELK 0.2.0-rc.2-hellfire.5 · Spino · 17 novembre 2026**

Ce guide installe le montage Police V08 sur le Gauntlet Hellfire de GTA V, modèle `gauntlet4`. Les fichiers distribués correspondent à la qualification **5/5 GTA solo**. Le multijoueur reste non testé.

## 1. Télécharger les fichiers

| Archive | Contenu |
| --- | --- |
| [Script CELK](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/01a52dbff9574908095e3f96c431b27872746437/telechargements/CELK-script-0.2.0-rc.2-hellfire.5.zip) | Dossier `celk_runtime`, 32 fichiers de code et de données. |
| [Pack Hellfire](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/01a52dbff9574908095e3f96c431b27872746437/telechargements/CELK-pack-Hellfire-personnel-fddf5f43.zip) | Dossier `ensemble-gauntlet4-fddf5f43`, trois ressources et le montage installable. |

[Empreintes SHA-256](SHA256SUMS.txt) · [Télécharger la configuration Hellfire](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/01a52dbff9574908095e3f96c431b27872746437/versions/0.2.0-rc.2-hellfire.5/celk.config.hellfire.example.json) · [Notes de version](README.md)

Utilise un serveur FiveM fonctionnel, FXServer **38435+**, une build GTA serveur **3889+** et OneSync. Le runtime déclare **Node.js 22**, fourni par FXServer. Le parcours autonome utilise les permissions ACE. Les raccordements Qbox, Ox, Luxart et garages tiers ont leur [suivi de compatibilité](../../COMPATIBILITE.md).

## 2. Copier les ressources

Dans les fichiers de la bonne instance txAdmin ou de ton hébergeur, ouvre le dossier `resources`.

1. Extrais le ZIP du script et copie son dossier `celk_runtime`.
2. Extrais le ZIP Hellfire. Copie les trois dossiers de `ensemble-gauntlet4-fddf5f43/resources` dans les ressources du serveur.
3. Crée `celk_runtime/local/install-sets`. Copie le dossier complet `ensemble-gauntlet4-fddf5f43` dedans. Conserve sa structure et ses fichiers pour le contrôle d’intégrité.
4. Crée `celk_runtime/local/celk.config.json` avec la configuration de l’étape suivante.

```text
resources/
├── celk_runtime/
│   ├── fxmanifest.lua
│   └── local/
│       ├── celk.config.json
│       └── install-sets/
│           └── ensemble-gauntlet4-fddf5f43/
│               ├── installation.json
│               ├── selection/
│               ├── resources/
│               └── LISEZ-MOI.md
├── celk_pack_hellfire_v06/
├── celk_pack_hellfire_v07/
└── celk_pack_hellfire_v08/
```

Chaque dossier de ressource doit contenir directement son `fxmanifest.lua`.

## 3. Configurer Hellfire

Télécharge la configuration Hellfire et enregistre-la sous `celk_runtime/local/celk.config.json`. Tu peux aussi copier le bloc JSON ci-dessous. Le fichier `celk.config.example.json` du ZIP script est l’exemple du Phantom.

<details open>
<summary><strong>Configuration Hellfire complète à copier</strong></summary>

```json
{
  "version": 1,
  "scopes": {
    "gauntlet4": "spino"
  },
  "packs": {
    "hellfire-feux-v07-lab": {
      "version": "0.7.0",
      "resource": "celk_pack_hellfire_v07",
      "sha256": "17068a6e96e618edfc0b4cdc48308a0d56c8fdce8b6ce1211fe3c7ac6f0e7d67"
    },
    "hellfire-police-v06-lab": {
      "version": "0.6.0",
      "resource": "celk_pack_hellfire_v06",
      "sha256": "140392180fb861fd752d6cdc33c5d99516318c806cad8746e2be5bd4e41fbb82"
    },
    "hellfire-rampe-v08-lab": {
      "version": "0.8.0",
      "resource": "celk_pack_hellfire_v08",
      "sha256": "bbd30a05ff290c2bbcb26b5a0ba1fb54c5c6f5d0a04860abedac256dd417228c"
    }
  }
}
```

</details>

L’ensemble exporté annonce le lecteur `hellfire.3`. Le lecteur **hellfire.5** reconnaît explicitement cette combinaison et ses empreintes. Les fichiers de l’export restent ceux qui ont été qualifiés.

Sur un serveur déjà équipé, travaille d’abord sur une copie et conserve sa configuration et ses données. L’installation d’une combinaison supplémentaire demande de vérifier ses ressources et sa qualification.

## 4. Régler le démarrage et les droits

Dans le CFG actif de l’instance, démarre les ressources dans cet ordre.

```cfg
ensure celk_pack_hellfire_v06
ensure celk_pack_hellfire_v07
ensure celk_pack_hellfire_v08
ensure celk_runtime
```

Active OneSync dans les paramètres de l’instance. Si le CFG gère ces paramètres, ajoute `set onesync on` et `set sv_enforceGameBuild 3889`. Garde la build déjà en service si elle est supérieure, avec une seule directive effective. La séance qualifiée utilise FXServer 38435 et GTA 3889.

Pour donner les trois droits CELK à un joueur d’essai, cet exemple utilise un groupe ACE. Remplace la licence par l’identifiant du joueur et adapte ensuite tes groupes au serveur.

```cfg
add_ace group.celk_admin celk.bind allow
add_ace group.celk_admin celk.fit allow
add_ace group.celk_admin celk.drive allow
add_principal identifier.license:REMPLACE_PAR_TA_LICENSE group.celk_admin
```

Démarre l’instance d’essai et consulte sa console.

## 5. Précontrôler et installer

Dans la **console serveur**, lance le précontrôle.

```text
celk_preflight_set ensemble-gauntlet4-fddf5f43
```

Le résultat doit identifier `gauntlet4`, la révision et la variante à ajouter. Copie l’**empreinte du plan** affichée, puis remplace `SHA_DU_PLAN` dans la commande suivante.

```text
celk_install_set ensemble-gauntlet4-fddf5f43 SHA_DU_PLAN
```

Après réussite, au créneau prévu pour l’instance, recharge CELK puis consulte son état.

```text
restart celk_runtime
celk_status
```

L’état doit afficher `gauntlet4`, la provenance `spino`, la révision **1** et **une variante chargée**. Un rejeu identique conserve l’index. Un contenu divergent sous le même identifiant donne un diagnostic à résoudre avant la mise à jour.

## 6. Utiliser le montage

Fais apparaître le modèle `gauntlet4` avec ton outil d’administration. Au volant, à l’arrêt, ouvre F8 et lie le véhicule avec un identifiant durable unique.

```text
celk_bind mon-hellfire-001
```

- **F6** ouvre le choix du montage. Sélectionne **Gauntlet Hellfire V08 · Pack Police complet**.
- **J** ouvre les scènes et les commandes de projecteurs. La scène fournie est **Hellfire complète · Double alternance**.
- **Q** commande les éclats.
- Pour les projecteurs, choisis la tête dans le menu puis utilise les commandes proposées. Le pavé **4 / 6 / 8 / 2** pilote la visée dans les limites exportées.

Après recréation de ce même véhicule, reprends son identifiant durable. Les touches sont réaffectables dans les réglages FiveM.

## Dépannage

<details>
<summary><strong>Le script ou le montage refuse de charger</strong></summary>

| Message ou symptôme | Vérification |
| --- | --- |
| Ressource absente ou arrêtée | Nom des trois dossiers de packs, `fxmanifest.lua` et ordre des `ensure`. |
| Version ou empreinte différente | Reprendre les deux ZIP associés et comparer les SHA-256. Conserver manifestes et actifs cohérents. |
| Configuration Phantom lue | Installer la configuration Hellfire de l’étape 3 dans `local/celk.config.json`. |
| Ensemble introuvable | Vérifier le dossier complet sous `local/install-sets/ensemble-gauntlet4-fddf5f43`. |
| Plan modifié | Relancer le précontrôle et employer sa nouvelle empreinte. |
| Variante divergente | Examiner le conflit de version avant l’activation. Garder une copie de l’index et des sauvegardes. |
| Commande refusée au joueur | Vérifier les ACE, son groupe et sa place de conducteur. |
| Aucun modèle dans `celk_status` | Vérifier l’installation, puis le redémarrage de CELK après réussite. |

</details>

## Limites de cette version

**128 modèles configurés**, **32 packs** et **32 Kio de configuration** au maximum. Une livraison active par modèle, jusqu’à **64 variantes par livraison** et **20 pièces actives sur un véhicule**. Un pack de pièces peut servir plusieurs modèles.

Chaque modèle installé demande une entrée dans `scopes`. Chaque ressource de pack utilisée demande une entrée dans `packs` et un démarrage avant CELK. Ces plafonds sont des contrôles du lecteur. La performance à ces volumes reste à mesurer.

Le parcours GTA qualifié porte sur le Hellfire de cette livraison. La coexistence avec le Phantom historique sous hellfire.5 et les raccordements tiers restent à qualifier. Le multijoueur est différé en phase 3.

## Mise à jour et retour arrière

1. Sauvegarde le runtime, les ressources de packs, le CFG et **tout `celk_runtime/local`**, avec leurs versions et empreintes.
2. Essaie la nouvelle paire sur une copie du serveur avec ses données. Conserve les configurations personnalisées et contrôle les montages et les choix sauvegardés après redémarrage.
3. Planifie l’intervention après ce contrôle. L’administrateur choisit le moment de la mise à jour.
4. Pour revenir à la version précédente, sauvegarde d’abord l’état récent, puis restaure l’ensemble cohérent du script, des packs, du CFG et des données locales de la copie précédente.

L’installation neuve et le rejeu du Hellfire exact sont vérifiés au banc. Les migrations et restaurations d’un serveur existant se valident avec ses propres données. [Parcours Phantom historique](../0.2.0-rc.1/INSTALLATION.md) · [Notes détaillées](README.md)

Création **Spino**. Les conditions de partage et la licence générale restent à définir.
